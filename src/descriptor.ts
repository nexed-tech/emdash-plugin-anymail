import {
  ALLOWED_HOSTS,
  CAPABILITIES,
  PLUGIN_ID,
  SETTINGS_SCHEMA,
} from "./settings-schema";
import { VERSION } from "./version";

/**
 * A native `PluginDescriptor` for EmDash's `emdash({ plugins: [...] })` array.
 *
 * Deliberately free of any `emdash` / plugin-runtime import so it stays cheap to
 * evaluate in `astro.config.mjs`. The real plugin lives at
 * `emdash-plugin-anymail/plugin`, which EmDash imports and instantiates at build
 * time via the `entrypoint` below.
 */
export interface AnymailDescriptor {
  id: string;
  version: string;
  entrypoint: string;
  format: "native";
  capabilities: string[];
  allowedHosts: string[];
  settingsSchema: typeof SETTINGS_SCHEMA;
  options?: Record<string, unknown>;
}

export function anymail(options?: Record<string, unknown>): AnymailDescriptor {
  return {
    id: PLUGIN_ID,
    version: VERSION,
    entrypoint: "emdash-plugin-anymail/plugin",
    format: "native",
    capabilities: [...CAPABILITIES],
    allowedHosts: [...ALLOWED_HOSTS],
    settingsSchema: SETTINGS_SCHEMA,
    ...(options ? { options } : {}),
  };
}

export default anymail;
