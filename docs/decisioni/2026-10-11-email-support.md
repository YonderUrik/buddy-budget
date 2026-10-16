# 2026-10-11 — Support email: support@buddybudget.io

- The support address moves from `supporto@buddybudget.io` to `support@buddybudget.io` (Daniele's request): constant `SUPPORT_EMAIL` in `lib/support/constants.ts` (recipient of reports and text of the form error), error message of `/api/support`, `ACCESSIBILITY.md`.
- `SUPPORT_EMAIL_TO` remains the server-side override; today it is not set in the infra repo, so the default applies.
- The previous log entries (`2026-10-10-aiuto-e-segnalazioni.md`, `2026-10-10-privacy-termini-cookie.md`) stay as they were: they describe the decision at the time.
- Outside the code: create the `support@` mailbox or alias at the email provider; decide whether to keep `supporto@` as a forward for a while. `privacy@` unchanged.
