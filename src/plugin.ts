import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

import { deliver } from "./core/deliver";
import { AnymailConfigError } from "./core/errors";
import { providerList } from "./core/providers";
import type { AddressInput, Logger } from "./core/types";
import { VERSION } from "./version";

/** Plugin id — also the settings namespace (`plugin:anymail:settings:*`). */
export const PLUGIN_ID = "anymail";

/**
 * Every field can come from either an environment variable or the admin
 * settings form. The env var wins when both are set.
 *
 * EmDash 0.36 stores `secret`-type settings in the database in plaintext
 * (encryption-at-rest is not shipped yet), so on a hosting platform with a
 * real secret store — Cloudflare's `wrangler secret put`, a container's env —
 * put at least `ANYMAIL_API_KEY` there and leave the admin field blank.
 */
const FIELDS = {
  provider: "ANYMAIL_PROVIDER",
  apiKey: "ANYMAIL_API_KEY",
  from: "ANYMAIL_FROM",
  fromName: "ANYMAIL_FROM_NAME",
  domain: "ANYMAIL_DOMAIN",
  endpoint: "ANYMAIL_ENDPOINT",
  retries: "ANYMAIL_RETRIES",
} as const;

type Field = keyof typeof FIELDS;

interface ResolvedConfig {
  provider: string | null;
  apiKey: string | null;
  from: string | null;
  fromName: string | null;
  domain: string | null;
  endpoint: string | null;
  retries: number | null;
  /** Per-field origin, for one diagnostic log line (never logs values). */
  sources: Partial<Record<Field, "env" | "settings">>;
}

function readEnv(name: string): string | null {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const value = env?.[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Merge env vars over the admin settings form, per field. */
async function resolveConfig(ctx: PluginContext): Promise<ResolvedConfig> {
  const settingEntries = await Promise.all(
    (Object.keys(FIELDS) as Field[]).map(
      async (field) => [field, await ctx.kv.get<unknown>(`settings:${field}`)] as const,
    ),
  );
  const settings = Object.fromEntries(settingEntries) as Record<Field, unknown>;
  const sources: ResolvedConfig["sources"] = {};

  const pick = (field: Field): string | null => {
    const fromEnv = readEnv(FIELDS[field]);
    if (fromEnv !== null) {
      sources[field] = "env";
      return fromEnv;
    }
    const fromSettings = settings[field];
    if (typeof fromSettings === "string" && fromSettings.length > 0) {
      sources[field] = "settings";
      return fromSettings;
    }
    if (typeof fromSettings === "number") {
      sources[field] = "settings";
      return String(fromSettings);
    }
    return null;
  };

  const retriesRaw = pick("retries");
  const retries = retriesRaw !== null && Number.isFinite(Number(retriesRaw)) ? Number(retriesRaw) : null;

  return {
    provider: pick("provider"),
    apiKey: pick("apiKey"),
    from: pick("from"),
    fromName: pick("fromName"),
    domain: pick("domain"),
    endpoint: pick("endpoint"),
    retries,
    sources,
  };
}

/**
 * `anymail` — an EmDash `email:deliver` provider backed by any HTTP email API.
 *
 * Add it to `emdash({ plugins: [...] })` in `astro.config.mjs`. Configure it
 * either in **Settings → Plugins → anymail** in the admin, or with `ANYMAIL_*`
 * environment variables (which take precedence). EmDash then routes every
 * system email (recovery links, invites, magic links) and every
 * `ctx.email.send()` call through it.
 */
export function createAnymailPlugin() {
  return definePlugin({
    id: PLUGIN_ID,
    version: VERSION,
    // `hooks.email-transport:register` is required or EmDash silently drops the
    // email:deliver hook. `network:request` covers the outbound API call when
    // the plugin runs sandboxed (in-process it uses the global fetch).
    capabilities: ["hooks.email-transport:register", "network:request"],
    allowedHosts: [
      "api.resend.com",
      "smtp.maileroo.com",
      "api.mailgun.net",
      "*.mailgun.net",
      "api.postmarkapp.com",
    ],

    admin: {
      settingsSchema: {
        provider: {
          type: "select",
          label: "Provider",
          description: "Which transactional email API to send through. Env: ANYMAIL_PROVIDER.",
          options: providerList.map((p) => ({ value: p.id, label: p.label })),
        },
        apiKey: {
          type: "secret",
          label: "API key",
          description:
            "The provider's API key or server token. Prefer the ANYMAIL_API_KEY env var / platform secret store — EmDash does not yet encrypt this field at rest.",
        },
        from: {
          type: "email",
          label: "From address",
          description: "Verified sender address, e.g. noreply@yourdomain.com. Env: ANYMAIL_FROM.",
        },
        fromName: {
          type: "string",
          label: "From name",
          description: "Display name recipients see (optional). Env: ANYMAIL_FROM_NAME.",
        },
        domain: {
          type: "string",
          label: "Sending domain",
          description:
            "Mailgun only — the domain configured in Mailgun (e.g. mg.yourdomain.com). Env: ANYMAIL_DOMAIN.",
        },
        endpoint: {
          type: "url",
          label: "API endpoint override",
          description:
            "Optional regional endpoint, e.g. https://api.eu.mailgun.net/v3 for Mailgun EU. Env: ANYMAIL_ENDPOINT.",
        },
        retries: {
          type: "number",
          label: "Retries",
          description: "Retry attempts on 429 / 5xx / network errors. Env: ANYMAIL_RETRIES.",
          default: 2,
          min: 0,
          max: 5,
        },
      },
    },

    hooks: {
      "email:deliver": async (event, ctx) => {
        const config = await resolveConfig(ctx);

        if (!config.provider) {
          throw new AnymailConfigError(
            "anymail: no provider set (ANYMAIL_PROVIDER or Settings → Plugins → anymail).",
          );
        }
        if (!config.apiKey) {
          throw new AnymailConfigError("anymail: no API key set (ANYMAIL_API_KEY or the admin field).");
        }
        if (!config.from) {
          throw new AnymailConfigError("anymail: no From address set (ANYMAIL_FROM or the admin field).");
        }

        ctx.log.debug?.("[anymail] config resolved", { provider: config.provider, sources: config.sources });

        const { message } = event;
        const from: AddressInput = config.fromName
          ? { email: config.from, name: config.fromName }
          : config.from;

        await deliver(
          {
            from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
          },
          {
            provider: config.provider,
            config: {
              apiKey: config.apiKey,
              ...(config.endpoint ? { endpoint: config.endpoint } : {}),
              ...(config.domain ? { domain: config.domain } : {}),
            },
            // Prefer EmDash's capability-scoped fetch when present (sandbox),
            // otherwise fall back to the global fetch (in-process).
            ...(ctx.http ? { fetch: ctx.http.fetch.bind(ctx.http) } : {}),
            logger: ctx.log as Logger,
            ...(config.retries !== null ? { retries: config.retries } : {}),
          },
        );
      },
    },
  });
}

export default createAnymailPlugin;
