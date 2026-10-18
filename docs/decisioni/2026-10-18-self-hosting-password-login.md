# 2026-10-18 — Self-hosting: password sign-in, any SMTP, first account only

A self-hosted install now works with no external service at all, sign-in included.

- **Sign-in**: email and password on self-hosted installs (`SELF_HOSTED=true`, set by `docker-compose.yml`) and whenever no email service is configured. The hosted version keeps the magic link and Google, unchanged. The emailed link is offered next to the password when an install has email.
- **Who can sign up**: only the first account of a self-hosted install, which the login page opens on («Crea il primo account»). `ALLOW_SIGNUPS=true` opens signups; `pnpm auth:create-user` adds one person; `pnpm auth:reset-password` resets a password without email (both in the `migrate` image).
- **Email**: one `sendEmail()` for the whole app, Resend or any SMTP server (`SMTP_URL`, `EMAIL_FROM`).
- **Not on self-hosted**: Terms acceptance of the hosted service, the Umami script, reports to the project's mailbox (only to `SUPPORT_EMAIL_TO`), inactive-account deletion.
- **Compose**: summary emails cron when email exists, `NOTIFICATIONS_MODE=execute`, the AI CSV worker behind `COMPOSE_PROFILES=ai`, English messages in the init script and compose.

Why: the magic link printed in the container log was the only way in, which breaks for anyone without a mail server and does not survive a lost session on a phone. Daniele asked for a self-hosted setup that is correct and hard to break before the Show HN launch. Password over passkeys or OIDC: it works everywhere with nothing to configure; OIDC can come later for people who already run an identity provider.

Details: `docs/self-hosting.md`, `docs/architecture/overview.md` §4.3.
