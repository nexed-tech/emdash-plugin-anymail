/**
 * `emdash-plugin-anymail/core` — the framework-agnostic email sender.
 *
 * No EmDash dependency. Use it directly from a Worker route, an API handler,
 * a script — anywhere with `fetch`.
 *
 * ```ts
 * import { deliver } from "emdash-plugin-anymail/core";
 *
 * await deliver(
 *   { from: "noreply@example.com", to: "a@b.com", subject: "Hi", text: "Hello" },
 *   { provider: "resend", config: { apiKey: process.env.RESEND_KEY! } },
 * );
 * ```
 */

export { deliver, normalize, type DeliverOptions } from "./deliver";
export { formatAddress, parseAddress, toAddressList } from "./address";
export { AnymailConfigError, AnymailError } from "./errors";
export {
  getProvider,
  mailgun,
  maileroo,
  postmark,
  providerList,
  providers,
  resend,
} from "./providers";
export type {
  Address,
  AddressInput,
  DeliveryResult,
  EmailProvider,
  FetchImpl,
  Logger,
  NormalizedEmail,
  OutgoingEmail,
  ProviderConfig,
  ProviderRequest,
} from "./types";
