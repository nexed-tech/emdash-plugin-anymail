# Changelog

## 0.1.0 — unreleased

- Initial release.
- EmDash `email:deliver` plugin with an auto-generated settings form
  (provider, API key, from address/name, Mailgun domain, endpoint override, retries).
- Framework-agnostic sender at `emdash-plugin-anymail/core`:
  `deliver()`, `normalize()`, address helpers, typed errors.
- Providers: Resend, Maileroo (v2), Mailgun (incl. EU endpoint), Postmark.
- Retry with exponential backoff on `429` / `5xx` / network error, honouring `Retry-After`.
