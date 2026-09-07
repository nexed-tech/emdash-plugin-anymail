import { describe, expect, it, vi } from "vitest";

import { deliver, normalize } from "../src/core/deliver";
import { AnymailConfigError, AnymailError } from "../src/core/errors";
import { silentLogger, stubFetch } from "./helpers";

const msg = {
  from: "Noreply <noreply@example.com>",
  to: "user@example.com",
  subject: "Hi",
  text: "Hello",
};

const base = {
  provider: "resend",
  config: { apiKey: "re_test" },
  logger: silentLogger,
  sleep: () => Promise.resolve(),
};

describe("normalize", () => {
  it("rejects a message with no recipients", () => {
    expect(() => normalize({ ...msg, to: [] })).toThrow(AnymailConfigError);
  });

  it("rejects a message with no subject", () => {
    expect(() => normalize({ ...msg, subject: "" })).toThrow(/subject/);
  });

  it("rejects a message with no body", () => {
    expect(() => normalize({ from: "a@b.com", to: "c@d.com", subject: "x" })).toThrow(/body/);
  });

  it("rejects a message with no from", () => {
    expect(() => normalize({ ...msg, from: "" })).toThrow(/from/);
  });
});

describe("deliver", () => {
  it("throws on an unknown provider", async () => {
    await expect(deliver(msg, { ...base, provider: "nope" })).rejects.toThrow(/Unknown email provider/);
  });

  it("throws when the API key is missing", async () => {
    await expect(deliver(msg, { ...base, config: { apiKey: "" } })).rejects.toThrow(/API key/);
  });

  it("returns the provider message id on success", async () => {
    const { fetch, calls } = stubFetch([{ status: 200, body: JSON.stringify({ id: "abc123" }) }]);
    const result = await deliver(msg, { ...base, fetch });

    expect(result).toEqual({ provider: "resend", status: 200, id: "abc123" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
  });

  it("retries on 500 then succeeds", async () => {
    const { fetch, calls } = stubFetch([
      { status: 500, body: "upstream boom" },
      { status: 200, body: JSON.stringify({ id: "ok" }) },
    ]);
    const result = await deliver(msg, { ...base, fetch, retries: 2 });

    expect(result.id).toBe("ok");
    expect(calls).toHaveLength(2);
  });

  it("retries on 429 honouring a numeric Retry-After", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const { fetch } = stubFetch([
      { status: 429, body: "slow down", headers: { "retry-after": "1" } },
      { status: 200, body: JSON.stringify({ id: "ok" }) },
    ]);
    await deliver(msg, { ...base, fetch, sleep, retries: 1 });

    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("gives up after exhausting retries and throws AnymailError with the body", async () => {
    const { fetch, calls } = stubFetch([
      { status: 503, body: "down" },
      { status: 503, body: "down" },
      { status: 503, body: "still down" },
    ]);

    const err = await deliver(msg, { ...base, fetch, retries: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(AnymailError);
    expect(err.status).toBe(503);
    expect(err.responseBody).toBe("still down");
    expect(calls).toHaveLength(3);
  });

  it("does not retry a 4xx", async () => {
    const { fetch, calls } = stubFetch([
      { status: 422, body: JSON.stringify({ message: "bad from" }) },
      { status: 200, body: "{}" },
    ]);

    await expect(deliver(msg, { ...base, fetch, retries: 3 })).rejects.toThrow(/HTTP 422/);
    expect(calls).toHaveLength(1);
  });

  it("wraps a network error after retries", async () => {
    const fetch = vi.fn(() => Promise.reject(new Error("ECONNRESET")));
    const err = await deliver(msg, { ...base, fetch, retries: 1 }).catch((e) => e);

    expect(err).toBeInstanceOf(AnymailError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
