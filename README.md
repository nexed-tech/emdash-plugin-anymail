# emdash-plugin-anymail

One [EmDash](https://emdash.dev) email plugin, any HTTP email provider.

EmDash needs an `email:deliver` provider before it can send recovery links, team
invites, magic-link logins, or anything a plugin passes to `ctx.email.send()`.
`anymail` is that provider — it talks to a transactional email **HTTP API**, so it
works on hosts that block outbound SMTP, **including the Cloudflare Workers free
plan**. No SMTP, no extra bindings — just `fetch`.

| Provider | Auth | Body | Notes |
|----------|------|------|-------|
| [Resend](https://resend.com) | Bearer token | JSON | |
| [Maileroo](https://maileroo.com) | `X-API-Key` | JSON | Sending API v2 |
| [Mailgun](https://mailgun.com) | HTTP Basic | multipart | needs a sending domain; set the EU endpoint for EU accounts |
| [Postmark](https://postmarkapp.com) | Server token | JSON | uses the `outbound` message stream |

Adding another is ~25 lines — see [`src/core/providers/`](src/core/providers/).

## Install

```sh
npm add emdash-plugin-anymail
```

```js
// astro.config.mjs
import { d1 } from "@emdash-cms/cloudflare";
import emdash from "emdash/astro";
import anymail from "emdash-plugin-anymail";

export default defineConfig({
  integrations: [
    emdash({
      database: d1({ binding: "DB" }),
      plugins: [anymail()],
    }),
  ],
});
```

## Configure

Every field can be set **either** in the admin **or** as an `ANYMAIL_*`
environment variable. When both are set, the env var wins.

| Field | Admin (Settings → Plugins → anymail) | Env var |
|-------|-------------------------------------|---------|
| Provider | Provider dropdown | `ANYMAIL_PROVIDER` (`resend` \| `maileroo` \| `mailgun` \| `postmark`) |
| API key | API key (secret) | `ANYMAIL_API_KEY` |
| From address | From address | `ANYMAIL_FROM` |
| From name | From name | `ANYMAIL_FROM_NAME` |
| Sending domain (Mailgun) | Sending domain | `ANYMAIL_DOMAIN` |
| Endpoint override | API endpoint override | `ANYMAIL_ENDPOINT` |
| Retries | Retries | `ANYMAIL_RETRIES` |

> **Put the API key in a real secret store, not the admin field.** EmDash 0.36
> stores `secret`-type plugin settings in the database in **plaintext**
> (encryption-at-rest isn't shipped yet), so they land in D1 backups and exports.
> On Cloudflare: `npx wrangler secret put ANYMAIL_API_KEY`. In a container: set it
> in the environment. The admin field stays available for local dev and for hosts
> without a secret store.

A minimal Cloudflare setup — provider + key as secrets, the rest in the admin:

```sh
npx wrangler secret put ANYMAIL_API_KEY
echo 'ANYMAIL_API_KEY = "re_dev_..."' >> .dev.vars   # local dev
```

```jsonc
// wrangler.jsonc — non-secret defaults are fine as plain vars
"vars": { "ANYMAIL_PROVIDER": "resend", "ANYMAIL_FROM": "noreply@yourdomain.com" }
```

EmDash auto-selects `anymail` as the email transport once it's the only provider
installed; otherwise pick it under **Settings → Email**.

> **Verify your sender domain first.** Every provider requires SPF/DKIM DNS
> records for the domain you send `From`. Do that in the provider's dashboard
> before going live or mail will bounce or land in spam.

## Standalone sender — `emdash-plugin-anymail/core`

The provider layer has no EmDash dependency. Use it directly from a Worker route,
an API handler, a contact form — anywhere with `fetch`:

```ts
import { deliver } from "emdash-plugin-anymail/core";

await deliver(
  {
    from: "Support <noreply@example.com>",
    to: "customer@example.com",
    replyTo: "inbox@example.com",
    subject: "We got your message",
    text: "Thanks — we'll reply within a day.",
  },
  {
    provider: "resend",
    config: { apiKey: env.RESEND_API_KEY },
    // fetch, logger, retries are all optional
  },
);
```

`deliver()` returns `{ provider, status, id? }` on success, throws
`AnymailConfigError` for bad input/config, and `AnymailError` (with `.status` and
`.responseBody`) when a provider rejects the send. Transient failures (`429`,
`5xx`, network) are retried with exponential backoff, honouring `Retry-After`.

## How it fits EmDash

```
EmDash system email ─┐
ctx.email.send() ────┼─▶ email:deliver hook ─▶ anymail ─▶ deliver() ─▶ provider HTTP API
                     ┘        (this plugin)      core
```

The plugin runs **in-process** (native format). It does not need Worker Loaders
or the paid plan. It declares `hooks.email-transport:register` (required, or
EmDash drops the hook) and `network:request`.

## Development

```sh
npm install
npm test          # vitest — provider request shapes + retry logic
npm run typecheck
npm run build     # tsup → dist/ (ESM + d.ts), dual entry: "." and "./core"
```

Releases: bump `version` in `package.json` **and** `src/version.ts`, tag, and
publish a GitHub Release — the `publish` workflow pushes to npm with provenance.

## License

MIT © Stephan Craane
