import { formatAddress } from "../address";
import { AnymailError } from "../errors";
import type { EmailProvider } from "../types";

/**
 * Postmark — https://postmarkapp.com/developer/api/email-api
 * Auth: `X-Postmark-Server-Token: <token>`. JSON body with PascalCase keys.
 * Response is `{ MessageID, ErrorCode, Message }` — `ErrorCode: 0` means sent.
 */
export const postmark: EmailProvider = {
  id: "postmark",
  label: "Postmark",
  defaultEndpoint: "https://api.postmarkapp.com/email",

  buildRequest(email, config) {
    const body: Record<string, unknown> = {
      From: formatAddress(email.from),
      To: email.to.map(formatAddress).join(", "),
      Subject: email.subject,
      MessageStream: "outbound",
    };
    if (email.cc.length) body.Cc = email.cc.map(formatAddress).join(", ");
    if (email.bcc.length) body.Bcc = email.bcc.map(formatAddress).join(", ");
    if (email.text) body.TextBody = email.text;
    if (email.html) body.HtmlBody = email.html;
    if (email.replyTo) body.ReplyTo = formatAddress(email.replyTo);
    const headers = Object.entries(email.headers);
    if (headers.length) body.Headers = headers.map(([Name, Value]) => ({ Name, Value }));

    return {
      url: config.endpoint,
      init: {
        method: "POST",
        headers: {
          "x-postmark-server-token": config.apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
      },
    };
  },

  parseResponse(res, body) {
    const json = body ? (JSON.parse(body) as { MessageID?: string; ErrorCode?: number; Message?: string }) : {};
    if (typeof json.ErrorCode === "number" && json.ErrorCode !== 0) {
      throw new AnymailError("postmark", json.Message ?? `Postmark error ${json.ErrorCode}`, {
        status: res.status,
        responseBody: body,
      });
    }
    return json.MessageID ? { id: json.MessageID } : {};
  },
};
