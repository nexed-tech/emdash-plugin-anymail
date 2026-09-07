import { afterEach, describe, expect, it, vi } from "vitest";

import { AnymailConfigError } from "../src/core/errors";
import { anymail } from "../src/descriptor";
import { createPlugin } from "../src/plugin";
import { PLUGIN_ID } from "../src/settings-schema";
import { headerValue, stubFetch } from "./helpers";

type Handler = (event: { message: unknown; source: string }, ctx: unknown) => Promise<void>;

function getHandler(): Handler {
  const plugin = createPlugin() as unknown as { hooks: Record<string, { handler: Handler }> };
  return plugin.hooks["email:deliver"]!.handler;
}

function fakeCtx(settings: Record<string, unknown>, fetch: ReturnType<typeof stubFetch>["fetch"]) {
  return {
    kv: { get: async (key: string) => settings[key.replace("settings:", "")] ?? null },
    http: { fetch },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

const message = { to: "user@example.com", subject: "Hi", text: "Hello" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("descriptor", () => {
  it("is a native descriptor pointing at the /plugin entrypoint", () => {
    const d = anymail();
    expect(d).toMatchObject({
      id: PLUGIN_ID,
      format: "native",
      entrypoint: "emdash-plugin-anymail/plugin",
    });
    expect(d.capabilities).toContain("hooks.email-transport:register");
    expect(d.settingsSchema.apiKey.type).toBe("secret");
  });

  it("carries options through when given", () => {
    expect(anymail({ foo: 1 }).options).toEqual({ foo: 1 });
    expect(anymail().options).toBeUndefined();
  });
});

describe("plugin definition", () => {
  it("has the expected id and a secret API-key field", () => {
    const plugin = createPlugin() as unknown as {
      id: string;
      capabilities: string[];
      admin: { settingsSchema: Record<string, { type: string }> };
    };
    expect(plugin.id).toBe(PLUGIN_ID);
    expect(plugin.capabilities).toContain("hooks.email-transport:register");
    expect(plugin.admin.settingsSchema.apiKey!.type).toBe("secret");
  });

  it("lists every built-in provider in the dropdown", () => {
    const plugin = createPlugin() as unknown as {
      admin: { settingsSchema: { provider: { options: Array<{ value: string }> } } };
    };
    expect(plugin.admin.settingsSchema.provider.options.map((o) => o.value)).toEqual([
      "resend",
      "maileroo",
      "mailgun",
      "postmark",
    ]);
  });
});

describe("email:deliver handler", () => {
  it("sends via the provider + key from the settings form", async () => {
    const { fetch, calls } = stubFetch([{ body: JSON.stringify({ id: "ok" }) }]);
    const ctx = fakeCtx(
      { provider: "resend", apiKey: "SETTING_KEY", from: "noreply@example.com" },
      fetch,
    );

    await getHandler()({ message, source: "system" }, ctx);

    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(headerValue(calls[0]!.init, "authorization")).toBe("Bearer SETTING_KEY");
  });

  it("lets ANYMAIL_* env vars win over the settings form", async () => {
    vi.stubEnv("ANYMAIL_API_KEY", "ENV_KEY");
    vi.stubEnv("ANYMAIL_PROVIDER", "postmark");

    const { fetch, calls } = stubFetch([{ body: JSON.stringify({ ErrorCode: 0, MessageID: "pm" }) }]);
    const ctx = fakeCtx(
      { provider: "resend", apiKey: "SETTING_KEY", from: "noreply@example.com" },
      fetch,
    );

    await getHandler()({ message, source: "system" }, ctx);

    expect(calls[0]!.url).toBe("https://api.postmarkapp.com/email");
    expect(headerValue(calls[0]!.init, "x-postmark-server-token")).toBe("ENV_KEY");
  });

  it("throws a clear error when no provider is configured", async () => {
    const { fetch } = stubFetch([]);
    const ctx = fakeCtx({ apiKey: "k", from: "a@b.com" }, fetch);

    await expect(getHandler()({ message, source: "system" }, ctx)).rejects.toBeInstanceOf(
      AnymailConfigError,
    );
  });

  it("passes a Mailgun sending domain through to the request path", async () => {
    vi.stubEnv("ANYMAIL_DOMAIN", "mg.example.com");
    const { fetch, calls } = stubFetch([{ body: JSON.stringify({ id: "<a@mg.example.com>" }) }]);
    const ctx = fakeCtx(
      { provider: "mailgun", apiKey: "key-x", from: "noreply@example.com" },
      fetch,
    );

    await getHandler()({ message, source: "system" }, ctx);

    expect(calls[0]!.url).toBe("https://api.mailgun.net/v3/mg.example.com/messages");
  });
});
