import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

import { deliver } from "./core/deliver";
import { AnymailConfigError } from "./core/errors";
import { providerList } from "./core/providers";
import type { AddressInput, Logger } from "./core/types";
import { VERSION } from "./version";

/** Plugin id — also the settings namespace (`plugin:anymail:settings:*`). */
export const PLUGIN_ID = "anymail";

/** The setting keys this plugin reads. Written by EmDash's auto-generated settings form. */
interface AnymailSettings {
  provider: string | null;
  apiKey: string | null;
  endpoint: string | null;
  domain: string | null;
  from: string | null;
  fromName: string | null;
  retries: number | null;
}

const SETTING_KEYS = [
  "provider",
  "apiKey",
  "endpoint",
  "domain",
  "from",
  "fromName",
  "retries",
] as const;

async function readSettings(ctx: PluginContext): Promise<AnymailSettings> {
  const pairs = await Promise.all(
    SETTING_KEYS.map(async (key) => [key, await ctx.kv.get<unknown>(`settings:${key}`)] as const),
  );
  const raw = Object.fromEntries(pairs) as Record<(typeof SETTING_KEYS)[number], unknown>;

  const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

  return {
    provider: str(raw.provider),
    apiKey: str(raw.apiKey),
    endpoint: str(raw.endpoint),
    domain: str(raw.domain),
    from: str(raw.from),
    fromName: str(raw.fromName),
    retries: num(raw.retries),
  };
}

/**
 * `anymail` — an EmDash `email:deliver` provider backed by any HTTP email API.
 *
 * Add it to `emdash({ plugins: [...] })` in `astro.config.mjs`, then open
 * **Settings → Plugins → anymail** in the admin and pick a provider + paste
 * an API key. EmDash then routes every system email (recovery links, invites,
 * magic links) and every `ctx.email.send()` call through it.
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
          description: "Which transactional email API to send through.",
          options: providerList.map((p) => ({ value: p.id, label: p.label })),
        },
        apiKey: {
          type: "secret",
          label: "API key",
          description: "The provider's API key or server token.",
        },
        from: {
          type: "email",
          label: "From address",
          description: "Verified sender address, e.g. noreply@yourdomain.com.",
        },
        fromName: {
          type: "string",
          label: "From name",
          description: "Display name recipients see (optional).",
        },
        domain: {
          type: "string",
          label: "Sending domain",
          description: "Mailgun only — the domain configured in Mailgun (e.g. mg.yourdomain.com).",
        },
        endpoint: {
          type: "url",
          label: "API endpoint override",
          description:
            "Optional. Use a regional endpoint here, e.g. https://api.eu.mailgun.net/v3 for Mailgun EU.",
        },
        retries: {
          type: "number",
          label: "Retries",
          description: "Retry attempts on 429 / 5xx / network errors.",
          default: 2,
          min: 0,
          max: 5,
        },
      },
    },

    hooks: {
      "email:deliver": async (event, ctx) => {
        const settings = await readSettings(ctx);

        if (!settings.provider) {
          throw new AnymailConfigError(
            "anymail: no provider selected (Settings → Plugins → anymail).",
          );
        }
        if (!settings.apiKey) {
          throw new AnymailConfigError("anymail: no API key configured.");
        }
        if (!settings.from) {
          throw new AnymailConfigError("anymail: no From address configured.");
        }

        const { message } = event;
        const from: AddressInput = settings.fromName
          ? { email: settings.from, name: settings.fromName }
          : settings.from;

        await deliver(
          {
            from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
          },
          {
            provider: settings.provider,
            config: {
              apiKey: settings.apiKey,
              ...(settings.endpoint ? { endpoint: settings.endpoint } : {}),
              ...(settings.domain ? { domain: settings.domain } : {}),
            },
            // Prefer EmDash's capability-scoped fetch when present (sandbox),
            // otherwise fall back to the global fetch (in-process).
            ...(ctx.http ? { fetch: ctx.http.fetch.bind(ctx.http) } : {}),
            logger: ctx.log as Logger,
            ...(settings.retries !== null ? { retries: settings.retries } : {}),
          },
        );
      },
    },
  });
}

export default createAnymailPlugin;
