import { describe, expect, it } from "vitest";

import { normalize } from "../src/core/deliver";
import { AnymailConfigError, AnymailError } from "../src/core/errors";
import { mailgun, maileroo, postmark, resend } from "../src/core/providers";
import { bodyText, headerValue } from "./helpers";

const email = normalize({
  from: { email: "noreply@example.com", name: "Example" },
  to: ["a@example.com", "Bee <b@example.com>"],
  subject: "Hello",
  text: "Plain body",
  html: "<p>HTML body</p>",
  replyTo: "support@example.com",
});

const withEndpoint = (p: { defaultEndpoint: string }, extra: Record<string, string> = {}) => ({
  apiKey: "KEY",
  endpoint: p.defaultEndpoint,
  ...extra,
});

describe("resend", () => {
  it("builds a Bearer + JSON request", async () => {
    const req = resend.buildRequest(email, withEndpoint(resend));
    expect(req.url).toBe("https://api.resend.com/emails");
    expect(headerValue(req.init, "authorization")).toBe("Bearer KEY");

    const body = JSON.parse(await bodyText(req.init));
    expect(body.from).toBe("Example <noreply@example.com>");
    expect(body.to).toEqual(["a@example.com", "Bee <b@example.com>"]);
    expect(body.reply_to).toBe("support@example.com");
    expect(body.text).toBe("Plain body");
    expect(body.html).toBe("<p>HTML body</p>");
  });

  it("reads the id from the response", () => {
    expect(resend.parseResponse(new Response(), JSON.stringify({ id: "re_1" }))).toEqual({ id: "re_1" });
  });
});

describe("maileroo", () => {
  it("builds an X-API-Key + structured-address request", async () => {
    const req = maileroo.buildRequest(email, withEndpoint(maileroo));
    expect(headerValue(req.init, "x-api-key")).toBe("KEY");

    const body = JSON.parse(await bodyText(req.init));
    expect(body.from).toEqual({ address: "noreply@example.com", display_name: "Example" });
    expect(body.to).toEqual([
      { address: "a@example.com" },
      { address: "b@example.com", display_name: "Bee" },
    ]);
    expect(body.plain).toBe("Plain body");
  });

  it("throws AnymailError when success is false", () => {
    expect(() =>
      maileroo.parseResponse(new Response("", { status: 200 }), JSON.stringify({ success: false, message: "bad domain" })),
    ).toThrow(AnymailError);
  });

  it("reads reference_id on success", () => {
    expect(
      maileroo.parseResponse(new Response(), JSON.stringify({ success: true, data: { reference_id: "ref_9" } })),
    ).toEqual({ id: "ref_9" });
  });
});

describe("mailgun", () => {
  it("requires a domain", () => {
    expect(() => mailgun.buildRequest(email, withEndpoint(mailgun))).toThrow(AnymailConfigError);
  });

  it("builds a Basic-auth multipart request with the domain in the path", async () => {
    const req = mailgun.buildRequest(email, withEndpoint(mailgun, { domain: "mg.example.com" }));
    expect(req.url).toBe("https://api.mailgun.net/v3/mg.example.com/messages");
    expect(headerValue(req.init, "authorization")).toBe(`Basic ${btoa("api:KEY")}`);
    expect(req.init.body).toBeInstanceOf(FormData);

    const form = req.init.body as FormData;
    expect(form.getAll("to")).toEqual(["a@example.com", "Bee <b@example.com>"]);
    expect(form.get("h:Reply-To")).toBe("support@example.com");
  });

  it("honours an EU endpoint override", () => {
    const req = mailgun.buildRequest(email, {
      apiKey: "KEY",
      endpoint: "https://api.eu.mailgun.net/v3",
      domain: "mg.example.com",
    });
    expect(req.url).toBe("https://api.eu.mailgun.net/v3/mg.example.com/messages");
  });

  it("strips angle brackets from the id", () => {
    expect(mailgun.parseResponse(new Response(), JSON.stringify({ id: "<20260907.1@mg.example.com>" }))).toEqual({
      id: "20260907.1@mg.example.com",
    });
  });
});

describe("postmark", () => {
  it("builds an X-Postmark-Server-Token + PascalCase request", async () => {
    const req = postmark.buildRequest(email, withEndpoint(postmark));
    expect(headerValue(req.init, "x-postmark-server-token")).toBe("KEY");

    const body = JSON.parse(await bodyText(req.init));
    expect(body.From).toBe("Example <noreply@example.com>");
    expect(body.To).toBe("a@example.com, Bee <b@example.com>");
    expect(body.TextBody).toBe("Plain body");
    expect(body.MessageStream).toBe("outbound");
  });

  it("throws when ErrorCode is non-zero", () => {
    expect(() =>
      postmark.parseResponse(new Response("", { status: 422 }), JSON.stringify({ ErrorCode: 300, Message: "Invalid 'From'" })),
    ).toThrow(/Invalid 'From'/);
  });

  it("returns MessageID when ErrorCode is zero", () => {
    expect(
      postmark.parseResponse(new Response(), JSON.stringify({ ErrorCode: 0, MessageID: "pm-1" })),
    ).toEqual({ id: "pm-1" });
  });
});
