/**
 * `emdash-plugin-anymail` — one EmDash email plugin, any HTTP email provider.
 *
 * ```ts
 * // astro.config.mjs
 * import anymail from "emdash-plugin-anymail";
 *
 * emdash({
 *   database: d1({ binding: "DB" }),
 *   plugins: [anymail()],
 * });
 * ```
 *
 * The default export is a lightweight `PluginDescriptor` factory (no `emdash`
 * dependency). The plugin runtime itself is at `emdash-plugin-anymail/plugin`,
 * and the framework-agnostic sender at `emdash-plugin-anymail/core`.
 */

export { anymail, anymail as default, type AnymailDescriptor } from "./descriptor";
export { PLUGIN_ID, ENV_VARS, SETTINGS_SCHEMA } from "./settings-schema";
export { VERSION } from "./version";

// Convenience: the core sender is also reachable from the package root.
export {
  deliver,
  normalize,
  parseAddress,
  formatAddress,
  providers,
  providerList,
  AnymailError,
  AnymailConfigError,
  type DeliverOptions,
  type OutgoingEmail,
  type ProviderConfig,
  type DeliveryResult,
  type EmailProvider,
} from "./core/index";
