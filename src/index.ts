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
 * The framework-agnostic sender is available separately at
 * `emdash-plugin-anymail/core` (no EmDash dependency).
 */

export { createAnymailPlugin, createAnymailPlugin as default, PLUGIN_ID } from "./plugin";
export { VERSION } from "./version";

// Re-export the core so `import { deliver } from "emdash-plugin-anymail"` also works.
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
