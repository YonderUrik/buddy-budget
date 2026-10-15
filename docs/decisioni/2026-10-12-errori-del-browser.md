# 2026-10-12 — Browser errors recorded without external services

Until today the app had neither `error.tsx` nor `global-error.tsx`: a page that broke showed Next's generic error and left no trace. Now the app screens have an error page with «Riprova» ("Retry") and «Segnala questo problema» ("Report this problem"), and every error goes to `POST /api/client-errors`, which writes it to the logs (`client.error.reported`, level `error`) and to the metric `buddybudget_client_errors_total{kind,area,outcome}`.

Choices: no Sentry or GlitchTip for now. Sentry cloud would send a financial app's errors outside, self-hosted Sentry needs 16 GB and GlitchTip about 0.5 GB on the VPS. Only the area is sent (first path segment, closed enum), never the full path, and the message goes through the logger's redaction. No stack trace, because without source maps it is unreadable. Limit of 20 errors every 10 minutes per user. The route requires the session, so errors on the login page do not arrive.

Postponed: GlitchTip, if errors become so many they need grouping; source maps. Full analysis: https://claude.ai/code/artifact/85881df9-9aa1-43b9-88f4-6b75499ab133

In the same PR: «Stato del servizio» ("Service status") link to the free UptimeRobot page (`https://stats.uptimerobot.com/BCuTWm0Ukg`, `STATUS_URL`) in the landing footer and at the top of the Aiuto (Help) page (event `support_link_opened` with `link: "stato"`). The free plan does not allow our own domain; no self-hosted status page for now.
