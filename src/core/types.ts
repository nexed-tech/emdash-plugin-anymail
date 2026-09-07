/**
 * Framework-agnostic email types.
 *
 * Nothing in `core/` imports EmDash — it is a plain `fetch`-based sender that
 * runs anywhere Node 18+ / Workers / Deno run. The EmDash plugin (`src/plugin.ts`)
 * is a thin adapter on top of this.
 */

/** A single mailbox — an address, optionally with a display name. */
export interface Address {
  email: string;
  name?: string;
}

/** An address as accepted on the public API: `"a@b.com"` or `"Name <a@b.com>"` or an {@link Address}. */
export type AddressInput = string | Address;

/** The message a caller hands to {@link deliver}. */
export interface OutgoingEmail {
  from: AddressInput;
  to: AddressInput | AddressInput[];
  subject: string;
  /** Plain-text body. At least one of `text` / `html` is required. */
  text?: string;
  /** HTML body. At least one of `text` / `html` is required. */
  html?: string;
  replyTo?: AddressInput;
  cc?: AddressInput | AddressInput[];
  bcc?: AddressInput | AddressInput[];
  /** Extra headers (`X-Entity-Ref-ID`, `List-Unsubscribe`, …). Provider support varies. */
  headers?: Record<string, string>;
}

/** The message after normalisation — what a provider adapter actually sees. */
export interface NormalizedEmail {
  from: Address;
  to: Address[];
  cc: Address[];
  bcc: Address[];
  replyTo?: Address;
  subject: string;
  text: string;
  html?: string;
  headers: Record<string, string>;
}

/** Per-provider connection settings. */
export interface ProviderConfig {
  /** API key / server token / secret for the provider. Required. */
  apiKey: string;
  /** Override the default API endpoint — set this for EU / regional endpoints. */
  endpoint?: string;
  /** Mailgun only: the sending domain configured in Mailgun (e.g. `mg.example.com`). */
  domain?: string;
}

/** What {@link deliver} returns on success. */
export interface DeliveryResult {
  /** The provider's message id, when it returns one. */
  id?: string;
  /** The provider that handled the send. */
  provider: string;
  /** HTTP status the provider API responded with. */
  status: number;
}

/** Minimal logger shape — `console` and EmDash's `ctx.log` both satisfy it. */
export interface Logger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/** `fetch`-compatible function. Injectable so callers can supply a scoped or mocked one. */
export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

/** The HTTP call an adapter wants {@link deliver} to make. */
export interface ProviderRequest {
  url: string;
  init: RequestInit;
}

/**
 * A provider adapter: turn a normalized message into one HTTP request, and
 * read the response back into a message id (or throw {@link AnymailError}).
 */
export interface EmailProvider {
  /** Stable id used in config (`provider: "resend"`) and log lines. */
  readonly id: string;
  /** Human-readable label for settings UIs. */
  readonly label: string;
  /** Default API endpoint, used when {@link ProviderConfig.endpoint} is unset. */
  readonly defaultEndpoint: string;
  /** Build the HTTP request for this message. May throw {@link AnymailConfigError}. */
  buildRequest(email: NormalizedEmail, config: Required<Pick<ProviderConfig, "endpoint">> & ProviderConfig): ProviderRequest;
  /** Inspect a 2xx response body; return `{ id }` or throw {@link AnymailError}. */
  parseResponse(res: Response, body: string): { id?: string };
}
