import type { EmailProvider } from "../types";
import { mailgun } from "./mailgun";
import { maileroo } from "./maileroo";
import { postmark } from "./postmark";
import { resend } from "./resend";

export { mailgun, maileroo, postmark, resend };

/** Every built-in provider, keyed by id. */
export const providers: Record<string, EmailProvider> = {
  [resend.id]: resend,
  [maileroo.id]: maileroo,
  [mailgun.id]: mailgun,
  [postmark.id]: postmark,
};

/** `{ id, label }` for each built-in provider — handy for building a settings dropdown. */
export const providerList: ReadonlyArray<{ id: string; label: string }> = Object.values(providers).map((p) => ({
  id: p.id,
  label: p.label,
}));

/** Look up a provider by id, or `undefined`. */
export function getProvider(id: string): EmailProvider | undefined {
  return providers[id];
}
