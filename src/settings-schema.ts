import { providerList } from "./core/providers";

/** Plugin id — also the settings namespace (`plugin:anymail:settings:*`). */
export const PLUGIN_ID = "anymail";

/**
 * Capabilities. `hooks.email-transport:register` is required or EmDash silently
 * drops the `email:deliver` hook. `network:request` covers the outbound API call
 * when the plugin runs sandboxed (in-process it uses the global fetch).
 */
export const CAPABILITIES = ["hooks.email-transport:register", "network:request"] as const;

/** Hosts the provider adapters call — needed when sandboxed. */
export const ALLOWED_HOSTS = [
  "api.resend.com",
  "smtp.maileroo.com",
  "api.mailgun.net",
  "*.mailgun.net",
  "api.postmarkapp.com",
] as const;

/**
 * Config field ↔ `ANYMAIL_*` environment variable.
 *
 * Every field can come from the env var or the admin settings form; the env
 * var wins. EmDash 0.36 stores `secret`-type settings in the database in
 * plaintext (encryption-at-rest isn't shipped), so put at least
 * `ANYMAIL_API_KEY` in a real secret store.
 */
export const ENV_VARS = {
  provider: "ANYMAIL_PROVIDER",
  apiKey: "ANYMAIL_API_KEY",
  from: "ANYMAIL_FROM",
  fromName: "ANYMAIL_FROM_NAME",
  domain: "ANYMAIL_DOMAIN",
  endpoint: "ANYMAIL_ENDPOINT",
  retries: "ANYMAIL_RETRIES",
} as const;

export type SettingKey = keyof typeof ENV_VARS;

/** The auto-generated admin settings form. Shared by the plugin and its descriptor. */
export const SETTINGS_SCHEMA = {
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
} as const;
