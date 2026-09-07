import type { Address, AddressInput } from "./types";

// "Display Name <local@domain>" or a bare "local@domain".
const ADDRESS_RE = /^\s*(?:"?([^"<]*?)"?\s+)?<?\s*([^\s<>@]+@[^\s<>@]+)\s*>?\s*$/;

/** Parse an {@link AddressInput} into an {@link Address}. Never throws — a garbage string comes back as `{ email }`. */
export function parseAddress(input: AddressInput): Address {
  if (typeof input !== "string") {
    return input.name ? { email: input.email, name: input.name } : { email: input.email };
  }
  const match = ADDRESS_RE.exec(input);
  if (!match) return { email: input.trim() };
  const name = match[1]?.trim();
  const email = match[2] as string;
  return name ? { email, name } : { email };
}

/** Format an {@link Address} as `"Name <email>"` (or just `email` when unnamed). */
export function formatAddress(addr: Address): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/** Normalise `undefined | one | many` into an array. */
export function toAddressList(input: AddressInput | AddressInput[] | undefined): Address[] {
  if (input === undefined) return [];
  return (Array.isArray(input) ? input : [input]).map(parseAddress);
}

/** base64 of an ASCII string — for Basic-auth credentials. `btoa` is global on Node 18+ and Workers. */
export function base64(ascii: string): string {
  return btoa(ascii);
}
