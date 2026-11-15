# Incremental GoCardless sync and exact cron durations

**Date:** 2026-11-13

**Context.** The Grafana panel «Latenza p95 per route» showed `cron.gocardless_sync` and `cron.market_prices` at 29.00 s, `cron.public_demo` at 9.75 s and `cron.net_worth_snapshot` at 4.88 s. Those are not durations: with one run in the window, `histogram_quantile(0.95)` interpolates inside the bucket (10–30 s → 29, 5–10 s → 9.75, 2.5–5 s → 4.875). Reading the jobs, only the GoCardless sync did avoidable work: it downloaded every account's whole history on every sync and re-inserted hundreds of rows that the unique key then skipped.

**Decision.**
- After the first sync, an account asks GoCardless only for transactions booked from 30 days before its last sync (`date_from`). Banks can publish a booked transaction days after its booking date (Daniele's concern), so the overlap is wide, and at most once a week (or whenever Redis has no record of it) the account still downloads its whole history. New rows that only the full download found are logged as `gocardless.sync.late_transactions`, to check the 30 days against real banks.
- Each cron's last successful duration is kept on Redis and exported as `buddybudget_cron_last_duration_seconds{cron}`, shown in the *Sync bancari e cron* dashboard instead of the interpolated quantile.
- `market_prices` stays sequential: its pauses per source (Yahoo 400 ms, Twelve Data 8 s) are what keeps Yahoo from answering 429, and no user waits for it. `public_demo` and `net_worth_snapshot` are a few seconds; the snapshot can take a small concurrency when users are in the thousands.

**Where.** `lib/gocardless/fetch-window.ts`, `lib/gocardless/sync.ts`, `lib/observability/ops-store.ts`; living docs `docs/architecture/bank-sync-and-imports.md` §4.3 and `docs/architecture/background-jobs.md`. No migration.
