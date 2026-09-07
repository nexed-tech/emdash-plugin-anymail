import { vi } from "vitest";

import type { FetchImpl, Logger } from "../src/core/types";

export const silentLogger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** A `fetch` stub that records calls and returns a canned sequence of responses. */
export function stubFetch(
  responses: Array<{ status?: number; body?: string; headers?: Record<string, string> }>,
): { fetch: FetchImpl; calls: Array<{ url: string; init: RequestInit | undefined }> } {
  const queue = [...responses];
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];

  const fetch: FetchImpl = async (url, init) => {
    calls.push({ url, init });
    const next = queue.shift() ?? { status: 200, body: "{}" };
    return new Response(next.body ?? "", {
      status: next.status ?? 200,
      headers: next.headers,
    });
  };

  return { fetch, calls };
}

/** Read a recorded request body as text (handles string and FormData). */
export async function bodyText(init: RequestInit | undefined): Promise<string> {
  const body = init?.body;
  if (typeof body === "string") return body;
  if (body instanceof FormData) {
    const parts: string[] = [];
    for (const [k, v] of body.entries()) parts.push(`${k}=${String(v)}`);
    return parts.join("&");
  }
  return "";
}

export function headerValue(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers as Record<string, string> | undefined;
  if (!headers) return undefined;
  const hit = Object.entries(headers).find(([k]) => k.toLowerCase() === name.toLowerCase());
  return hit?.[1];
}
