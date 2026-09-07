import { base64, formatAddress } from "../address";
import { AnymailConfigError } from "../errors";
import type { EmailProvider } from "../types";

/**
 * Mailgun — https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/Messages/
 * Auth: HTTP Basic `api:<key>`. multipart/form-data body. Domain in the URL path.
 * For the EU region set the endpoint override to `https://api.eu.mailgun.net/v3`.
 * Success response: `{ id: "<...@domain>", message: "Queued. ..." }`.
 */
export const mailgun: EmailProvider = {
  id: "mailgun",
  label: "Mailgun",
  defaultEndpoint: "https://api.mailgun.net/v3",

  buildRequest(email, config) {
    if (!config.domain) {
      throw new AnymailConfigError("Mailgun requires a sending domain — set it in the plugin settings.");
    }

    const form = new FormData();
    form.set("from", formatAddress(email.from));
    for (const to of email.to) form.append("to", formatAddress(to));
    for (const cc of email.cc) form.append("cc", formatAddress(cc));
    for (const bcc of email.bcc) form.append("bcc", formatAddress(bcc));
    form.set("subject", email.subject);
    if (email.text) form.set("text", email.text);
    if (email.html) form.set("html", email.html);
    if (email.replyTo) form.set("h:Reply-To", formatAddress(email.replyTo));
    for (const [name, value] of Object.entries(email.headers)) form.set(`h:${name}`, value);

    const base = config.endpoint.replace(/\/+$/, "");
    return {
      url: `${base}/${config.domain}/messages`,
      init: {
        method: "POST",
        headers: { authorization: `Basic ${base64(`api:${config.apiKey}`)}` },
        body: form,
      },
    };
  },

  parseResponse(_res, body) {
    const json = body ? (JSON.parse(body) as { id?: string }) : {};
    // Mailgun wraps the id in angle brackets: "<20260907...@mg.example.com>".
    return json.id ? { id: json.id.replace(/^<|>$/g, "") } : {};
  },
};
