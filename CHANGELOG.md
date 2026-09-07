# Changelog

## 0.1.0 — unreleased

- Initial release.
- EmDash `email:deliver` plugin with an auto-generated settings form
  (provider, API key, from address/name, Mailgun domain, endpoint override, retries).
- Every setting also reads from an `ANYMAIL_*` environment variable, which takes
  precedence over the admin field — keep the API key out of the database.
- Framework-agnostic sender at `emdash-plugin-anymail/core`:
  `deliver()`, `normalize()`, address helpers, typed errors.
- Providers: Resend, Maileroo (v2), Mailgun (incl. EU endpoint), Postmark.
- Retry with exponential backoff on `429` / `5xx` / network error, honouring `Retry-After`.
