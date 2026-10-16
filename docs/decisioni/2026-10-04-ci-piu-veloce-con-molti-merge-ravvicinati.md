# Faster CI with many back-to-back merges

Date: 2026-10-04

Measured on real runs: the app check took ~165 s, of which ~90 s were tests (one file at a time, on a real Postgres). Now lint and types run in a separate job and tests are split into 2 shards with one database each; the required "Lint, tipi e test" check remains, as a summary of the three jobs. The landing screenshots are no longer regenerated on every merge (5 runs of ~3 minutes in an hour, plus the CI of the bot's PR): they run daily, when the screen list/scripts/demo data change, or manually. Proposals that touch the merge flow or the deploy (merge queue, concurrency of runs on `main`, skipping CI on the release commit, decision log per file) are still to be decided: see the report in the thread.
