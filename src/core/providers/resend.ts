import { formatAddress } from "../address";
import type { EmailProvider } from "../types";

/**
 * Resend — https://resend.com/docs/api-reference/emails/send-email
 * Auth: `Authorization: Bearer re_...`. JSON body. Returns `{ id }`.
 */
export const resend: EmailProvider = {
  id: "resend",
  label: "Resend",
  defaultEndpoint: "https://api.resend.com/emails",

  buildRequest(email, config) {
    const body: Record<string, unknown> = {
      from: formatAddress(email.from),
      to: email.to.map(formatAddress),
      subject: email.subject,
    };
    if (email.text) body.text = email.text;
    if (email.html) body.html = email.html;
    if (email.cc.length) body.cc = email.cc.map(formatAddress);
    if (email.bcc.length) body.bcc = email.bcc.map(formatAddress);
    if (email.replyTo) body.reply_to = formatAddress(email.replyTo);
    if (Object.keys(email.headers).length) body.headers = email.headers;

    return {
      url: config.endpoint,
      init: {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    };
  },

  parseResponse(_res, body) {
    const json = body ? (JSON.parse(body) as { id?: string }) : {};
    return json.id ? { id: json.id } : {};
  },
};
