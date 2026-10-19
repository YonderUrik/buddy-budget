# «Dall'ultima visita» toast (2026-10-19)

**Decision**: when a returning user opens the app, a toast says what happened while they were away (new movements, price alerts gone off, subscriptions that cost more) and what waits for them (movements without a category, subscriptions to confirm, imports with rows to check), with one action. Once per visit, on any page; a visit ends after 30 minutes without a heartbeat from the open app. Migration 0046.
**Why**: Daniele asked to tell the user, on entering the app, what happened and whether something needs them. A first version as a block at the top of Panoramica felt dropped there without a reason; he asked for something less intrusive, like a toast. The toast says it all in its title (counts only, no amounts): a description under it repeated the same kind of line.
**Not repeated**: «Primi passi» (new users), the bank renewal banner and «Prossime rate» keep their own places; no overlay, no emails (the weekly recap exists separately).
**Deferred**: net worth change since the last visit, the same summary as a push notification in the native app.
Details: `docs/architecture/overview.md` §4.17.
