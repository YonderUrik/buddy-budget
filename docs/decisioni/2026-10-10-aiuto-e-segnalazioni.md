# 2026-10-10 — Help and reports

`/aiuto` page reachable from the avatar menu (not from the sidebar, so as not to take up navigation with a rarely used feature): quick answers, «Scrivici» ("Write to us") form (problem / question / idea) and links to GitHub (prefilled issue, open reports, releases, security policy).

- The form sends an email to `supporto@buddybudget.io` (`SUPPORT_EMAIL_TO` to change it) with reply-to set to the user, via Resend; limit of 5 reports per hour per user on Redis; reference code `SUP-XXXXXX`.
- Attached context (can be removed and is shown before sending): page without query, app version, screen, theme, user agent. No financial data; text and email do not end up in the logs.
- Rejected: AI chatbot (costs, risk of wrong answers on tax topics, text sent to an external provider). To be reconsidered with real reports. Also rejected automatic creation of issues from the form: private reports would become public.
- Postponed: Grafana panel and alert on failed sending (the `buddybudget_support_reports_total` metric exists, the user sees the error); FAQ read from a single source shared with the landing.
