# Guided self-hosting setup

The terminal wizard configures personal or server access, public address, OpenRouter, Yahoo connectivity, Resend and optional services. Secrets stay hidden and are saved atomically with private permissions only after confirmation. The AI worker and notification scheduler follow the saved configuration.

Personal mode is loopback-only and uses a normal signed Better Auth session for one owner. Host, Origin and Fetch-Site checks prevent foreign automatic access. Switching to server mode preserves data and revokes automatic sessions; the owner supplies a real email and sets a password using the existing administration command when password login is enabled.

`selfhost-init.sh --build` builds the checkout and waits for readiness. `selfhost-start.sh` restarts saved configuration; uninstall keeps data by default and requires explicit confirmation to purge it. Settings exposes configuration status without secrets.

On 2026-10-25 the five setup commits were rebased directly onto current main, excluding the closed import-correction dependency. Main's password login, SMTP transport, signup restrictions, public-demo rules, security checks and versioned migrations are retained. Local mode disables interactive sign-in; SMTP delivery remains available for notifications.

Validation covers setup cancellation, secret preservation, worker configuration, startup failures, personal session security, routing and owner transitions. Paid AI requests, real email delivery, Google OAuth and bank connections remain operator checks requiring configured credentials.

Rebase validation: 42 setup/launcher checks, 94 focused auth/routing/instance/catalog tests, and the isolated Postgres owner-transition test passed. TypeScript, catalog synchronization and diff checks passed; lint had 0 errors and 11 existing warnings. The full app run passed 2,875 tests and skipped one, with a missing English feature entry subsequently fixed and retested and the unchanged logger test failing because its stack contains `/Users/mario`. No database schema or migration changes remain relative to main. Fresh GitHub CI and a Docker/browser trial of this rebased combination remain pending.
