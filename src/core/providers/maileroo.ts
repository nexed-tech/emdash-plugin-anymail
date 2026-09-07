import { AnymailError } from "../errors";
import type { Address, EmailProvider } from "../types";

/**
 * Maileroo — https://maileroo.com/docs (Sending API v2).
 * Auth: `X-API-Key: <key>`. JSON body with structured addresses.
 * Success response: `{ success: true, data: { reference_id } }`.
 *
 * If your Maileroo account is on the legacy `POST /send` multipart API, set
 * the plugin's endpoint override and adjust — this adapter targets v2 JSON.
 */
export const maileroo: EmailProvider = {
  id: "maileroo",
  label: "Maileroo",
  defaultEndpoint: "https://smtp.maileroo.com/api/v2/emails",

  buildRequest(email, config) {
    const addr = (a: Address) => (a.name ? { address: a.email, display_name: a.name } : { address: a.email });

    const body: Record<string, unknown> = {
      from: addr(email.from),
      to: email.to.map(addr),
      subject: email.subject,
    };
    if (email.text) body.plain = email.text;
    if (email.html) body.html = email.html;
    if (email.cc.length) body.cc = email.cc.map(addr);
    if (email.bcc.length) body.bcc = email.bcc.map(addr);
    if (email.replyTo) body.reply_to = addr(email.replyTo);
    if (Object.keys(email.headers).length) body.headers = email.headers;

    return {
      url: config.endpoint,
      init: {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    };
  },

  parseResponse(res, body) {
    const json = body ? (JSON.parse(body) as { success?: boolean; message?: string; data?: { reference_id?: string } }) : {};
    if (json.success === false) {
      throw new AnymailError("maileroo", json.message ?? "Maileroo reported failure", {
        status: res.status,
        responseBody: body,
      });
    }
    return json.data?.reference_id ? { id: json.data.reference_id } : {};
  },
};
