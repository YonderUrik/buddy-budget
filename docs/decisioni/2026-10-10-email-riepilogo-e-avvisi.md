# Summary and alert emails, always with unsubscribe (2026-10-10)

Decision: three types of optional emails (periodic summary, budget alerts, instalment due-date alerts) with a daily cron `/api/cron/notifications`. The content uses the figures already computed by the app (`lib/calc/expenses`, `lib/debts`), never investment advice.
Daniele's rule: every non-service email always has the unsubscribe link and the preferences; service emails (sign-in, account, bank connection, import outcome, price alert) remain without, and say so in the footer (`SERVICE_FOOTER_TEXT`).
Opt-in: without a row in `notification_preferences` everything is off (`NOTIFICATION_DEFAULTS`); to change the default just change that constant. Managed in Impostazioni → Notifiche (Settings → Notifications).
Unsubscribe: signed token (HMAC from `BETTER_AUTH_SECRET`, does not expire), public `/disiscrizione` page with one click, one-click POST `/api/email/unsubscribe` for `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058). A GET never unsubscribes (antivirus and previews).
Cadence: monthly summary (default) in the first 3 days of the month or weekly on Monday/Tuesday, over the completed period, only if there are transactions. Alerts: budget at 80% and 100% of the category (once per month and threshold), instalments 3 days before the due date or overdue; at most one alert per day and three per week (budget and due dates together), plus deduplication on `notification_log` (90 days).
`NOTIFICATIONS_MODE` = `off` | `dry-run` (default, does not send) | `execute`. In production it is switched to `execute` by hand in the Secret after a few days of dry-run.
With «nascondi importi» ("hide amounts") the figures in the email are masked; subjects never contain figures or names.
Postponed: alerts on investments and net worth, user-chosen time, in-app preview, test on real clients (Gmail, Outlook, Apple Mail), mailto in `List-Unsubscribe`.
