# «Dall'ultima visita» on Panoramica (2026-10-19)

**Decision**: when a returning user opens the app, Panoramica shows at the top what happened while they were away (new movements with income and spending, price alerts gone off, subscriptions that cost more) and what waits for them (movements without a category, subscriptions to confirm, imports with rows to check), each line with its link or action. A visit ends after 30 minutes without a heartbeat from the open app; the summary counts from the end of the previous visit, stays the same for the whole visit and can be closed until the next one. Migration 0045 (number to recheck at merge: #456 also wants 0045).
**Why**: Daniele asked to tell the user, on entering the app, what happened and whether something needs them.
**Not repeated**: «Primi passi» (new users), the bank renewal banner and «Prossime rate» keep their own places; no overlay, no emails (the weekly recap exists separately).
**Deferred**: net worth change since the last visit (Panoramica's chart already shows the period), goals reached, the same summary as a push notification in the native app.
Details: `docs/architecture/overview.md` §4.17.
