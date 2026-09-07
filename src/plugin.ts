import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

import { deliver } from "./core/deliver";
import { AnymailConfigError } from "./core/errors";
import type { AddressInput, Logger } from "./core/types";
import {
  ALLOWED_HOSTS,
  CAPABILITIES,
  ENV_VARS,
  PLUGIN_ID,
  SETTINGS_SCHEMA,
  type SettingKey,
} from "./settings-schema";
import { VERSION } from "./version";

interface ResolvedConfig {
  provider: string | null;
  apiKey: string | null;
  from: string | null;
  fromName: string | null;
  domain: string | null;
  endpoint: string | null;
  retries: number | null;
  /** Per-field origin, for one diagnostic log line (never logs values). */
  sources: Partial<Record<SettingKey, "env" | "settings">>;
}

function readEnv(name: string): string | null {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const value = env?.[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Merge `ANYMAIL_*` env vars over the admin settings form, per field. */
async function resolveConfig(ctx: PluginContext): Promise<ResolvedConfig> {
  const fields = Object.keys(ENV_VARS) as SettingKey[];
  const settingEntries = await Promise.all(
    fields.map(async (field) => [field, await ctx.kv.get<unknown>(`settings:${field}`)] as const),
  );
  const settings = Object.fromEntries(settingEntries) as Record<SettingKey, unknown>;
  const sources: ResolvedConfig["sources"] = {};

  const pick = (field: SettingKey): string | null => {
    const fromEnv = readEnv(ENV_VARS[field]);
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
 * The EmDash plugin entrypoint. EmDash's astro integration imports this as
 * `import { createPlugin } from "emdash-plugin-anymail/plugin"` and calls it.
 *
 * `options` is accepted for the descriptor contract but unused — configure the
 * plugin with `ANYMAIL_*` env vars or the admin settings form.
 */
export function createPlugin(_options: Record<string, unknown> = {}) {
  return definePlugin({
    id: PLUGIN_ID,
    version: VERSION,
    capabilities: [...CAPABILITIES],
    allowedHosts: [...ALLOWED_HOSTS],
    admin: { settingsSchema: { ...SETTINGS_SCHEMA } },

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

export default createPlugin;
