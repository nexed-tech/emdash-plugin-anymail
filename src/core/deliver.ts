import { formatAddress, parseAddress, toAddressList } from "./address";
import { AnymailConfigError, AnymailError } from "./errors";
import { getProvider, providers } from "./providers";
import type {
  DeliveryResult,
  FetchImpl,
  Logger,
  NormalizedEmail,
  OutgoingEmail,
  ProviderConfig,
} from "./types";

export interface DeliverOptions {
  /** Provider id: `"resend"`, `"maileroo"`, `"mailgun"`, `"postmark"`. */
  provider: string;
  /** Connection settings for that provider. */
  config: ProviderConfig;
  /** `fetch` to use. Defaults to the global `fetch`. */
  fetch?: FetchImpl;
  /** Where to log the one-line send / failure record. Defaults to `console`. */
  logger?: Logger;
  /** Retry attempts on `429` / `5xx` / network error. Default `2` (3 tries total). */
  retries?: number;
  /** @internal test seam — sleep between retries. Defaults to real exponential backoff. */
  sleep?: (ms: number) => Promise<void>;
}

const MAX_BODY_LOG = 500;

/** Validate + canonicalise an {@link OutgoingEmail}. Throws {@link AnymailConfigError} on bad input. */
export function normalize(email: OutgoingEmail): NormalizedEmail {
  const to = toAddressList(email.to);
  if (to.length === 0) throw new AnymailConfigError("email.to is required");
  if (!email.subject) throw new AnymailConfigError("email.subject is required");
  if (!email.text && !email.html) throw new AnymailConfigError("email needs a text or html body");
  if (email.from === undefined || email.from === "") throw new AnymailConfigError("email.from is required");

  return {
    from: parseAddress(email.from),
    to,
    cc: toAddressList(email.cc),
    bcc: toAddressList(email.bcc),
    ...(email.replyTo ? { replyTo: parseAddress(email.replyTo) } : {}),
    subject: email.subject,
    text: email.text ?? "",
    ...(email.html ? { html: email.html } : {}),
    headers: email.headers ?? {},
  };
}

/**
 * Send one email through the configured provider.
 *
 * Builds the provider's HTTP request, `fetch`es it, retries transient failures
 * with exponential backoff, logs a one-line record, and returns the message id.
 * Throws {@link AnymailConfigError} for bad input/config and {@link AnymailError}
 * when the provider rejects the send.
 */
export async function deliver(email: OutgoingEmail, options: DeliverOptions): Promise<DeliveryResult> {
  const provider = getProvider(options.provider);
  if (!provider) {
    throw new AnymailConfigError(
      `Unknown email provider "${options.provider}". Known providers: ${Object.keys(providers).join(", ")}.`,
    );
  }
  if (!options.config?.apiKey) {
    throw new AnymailConfigError(`Provider "${provider.id}" requires an API key.`);
  }

  const doFetch: FetchImpl | undefined = options.fetch ?? (globalThis.fetch as FetchImpl | undefined);
  if (!doFetch) throw new AnymailConfigError("No fetch implementation available — pass `options.fetch`.");

  const log: Logger = options.logger ?? console;
  const retries = Math.max(0, options.retries ?? 2);
  const sleep = options.sleep ?? defaultSleep;

  const normalized = normalize(email);
  const config = { ...options.config, endpoint: options.config.endpoint || provider.defaultEndpoint };
  const { url, init } = provider.buildRequest(normalized, config);
  const recipients = normalized.to.map((a) => a.email).join(",");

  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now();
    let res: Response;

    try {
      res = await doFetch(url, init);
    } catch (cause) {
      if (attempt < retries) {
        log.warn(`[anymail] ${provider.id} network error, retrying (${attempt + 1}/${retries})`);
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new AnymailError(provider.id, `Network error calling ${provider.label}`, { cause });
    }

    const body = await res.text();
    const elapsedMs = Date.now() - startedAt;

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      log.warn(`[anymail] ${provider.id} responded ${res.status}, retrying (${attempt + 1}/${retries})`);
      await sleep(retryAfterMs(res.headers.get("retry-after")) ?? backoffMs(attempt));
      continue;
    }

    if (!res.ok) {
      log.error(`[anymail] ${provider.id} send failed to=${recipients} status=${res.status} body=${truncate(body)}`);
      throw new AnymailError(provider.id, `${provider.label} returned HTTP ${res.status}`, {
        status: res.status,
        responseBody: body,
      });
    }

    let parsed: { id?: string };
    try {
      parsed = provider.parseResponse(res, body);
    } catch (cause) {
      if (cause instanceof AnymailError) {
        log.error(`[anymail] ${provider.id} send rejected to=${recipients}: ${cause.message}`);
        throw cause;
      }
      log.error(`[anymail] ${provider.id} unreadable response to=${recipients} body=${truncate(body)}`);
      throw new AnymailError(provider.id, `Could not parse ${provider.label} response`, {
        status: res.status,
        responseBody: body,
        cause,
      });
    }

    log.info(
      `[anymail] sent via ${provider.id} to=${recipients}` +
        `${parsed.id ? ` id=${parsed.id}` : ""} status=${res.status} ${elapsedMs}ms`,
    );
    return { provider: provider.id, status: res.status, ...(parsed.id ? { id: parsed.id } : {}) };
  }
}

function truncate(s: string, max = MAX_BODY_LOG): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function backoffMs(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 8000);
}

function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds, 0) * 1000, 30_000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 30_000);
  return undefined;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { formatAddress, parseAddress };
