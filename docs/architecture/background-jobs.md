# Background jobs and crons

This document describes how BuddyBudget runs work that does not fit inside one HTTP request. It covers user-triggered background jobs with visible progress, fire-and-forget background tasks, the personal CSV import queue, and the scheduled crons under `app/api/cron/*`. The job machinery lives in [`lib/sync-jobs/`](../../lib/sync-jobs/), [`lib/market-data/backfill-state.ts`](../../lib/market-data/backfill-state.ts) and [`lib/personal-import/`](../../lib/personal-import/). Cron authentication is in [`lib/cron/auth.ts`](../../lib/cron/auth.ts), and cron bookkeeping is in [`lib/observability/heartbeat.ts`](../../lib/observability/heartbeat.ts). The schedules are in the infra repo (`buddy-budget-infra/argocd/manifests/app/cronjob-*.yaml`) and in [`docker-compose.yml`](../../docker-compose.yml) for self-hosting.

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Start a job | Authenticated POST (manual sync, bank finalize) | `202 { jobId }` or `201 { jobId }`; job meta and per-account keys on Redis | [`app/api/gocardless/accounts/[accountId]/sync/route.ts`](../../app/api/gocardless/accounts/[accountId]/sync/route.ts), [`app/api/gocardless/connections/[id]/finalize/route.ts`](../../app/api/gocardless/connections/[id]/finalize/route.ts) |
| Run the work | `SyncJob` + `SyncableLink[]` inside `after()` | Transactions in Postgres, per-account progress on Redis | [`lib/sync-jobs/run.ts`](../../lib/sync-jobs/run.ts) `runSyncJob`, [`lib/gocardless/sync.ts`](../../lib/gocardless/sync.ts) `syncAccountLink` |
| Store state | Patches from `onProgress` | Redis keys with a 24 h TTL | [`lib/sync-jobs/store.ts`](../../lib/sync-jobs/store.ts), [`lib/sync-jobs/redis-store.ts`](../../lib/sync-jobs/redis-store.ts) |
| Read state | `GET /api/sync-jobs` | `SyncJobView[]` with `interrupted` evaluated | [`app/api/sync-jobs/route.ts`](../../app/api/sync-jobs/route.ts), [`lib/sync-jobs/view.ts`](../../lib/sync-jobs/view.ts) |
| Show progress | Poll every 1 s while a job runs | Global panel in the app layout, cache invalidation at the end | [`lib/queries/sync-jobs.ts`](../../lib/queries/sync-jobs.ts), [`components/domain/sync/sync-progress-indicator.tsx`](../../components/domain/sync/sync-progress-indicator.tsx) |
| Price history backfill | Instrument without prices from a date | Prices in Postgres, state on Redis per instrument | [`lib/market-data/runtime.ts`](../../lib/market-data/runtime.ts) `ensureHistory`, [`lib/market-data/backfill-state.ts`](../../lib/market-data/backfill-state.ts) |
| Personal CSV queue | Encrypted CSV row in `personal_import_jobs` | Imported transactions/trades, email | [`lib/personal-import/jobs.ts`](../../lib/personal-import/jobs.ts), [`lib/personal-import/worker.ts`](../../lib/personal-import/worker.ts), [`scripts/personal-csv-worker.ts`](../../scripts/personal-csv-worker.ts) |
| Crons | `GET /api/cron/<name>` with `Authorization: Bearer <CRON_SECRET>` | JSON with counts; `recordCronRun` metric, log and heartbeat | [`app/api/cron/`](../../app/api/cron/) |

```text
 browser                     app pod (Next.js)                         Redis                  Postgres
 -------                     -----------------                         -----                  --------
 POST /sync  ─────────────►  validate, lock, createJob  ─────────────► sync-job:* keys
            ◄── 202 {jobId}  after(): runSyncJob
                               syncAccountLink(onProgress) ──────────► updateAccount ───────► insert 50 rows
 GET /api/sync-jobs (1 s) ─►  listJobs + toJobView      ◄───────────── read keys
            ◄── jobs[]
 job finished → invalidate ["accounts"], ["net-worth-snapshots"], categorisation keys

 k8s CronJob (curl) ── GET /api/cron/x ──► isAuthorizedCronRequest → run → recordCronRun ──► ops:heartbeat:cron:x
```

## 2. Principles

**P1 — The request validates, the job works.** Ownership, eligibility and the per-account lock are checked synchronously, so predictable failures come back as HTTP status codes (404, 409, 429, 503). Only then is the job created and the work handed to `after()` (see the sync route).

**P2 — Job state is ephemeral and lives on Redis.** Sync jobs and backfill states are JSON values with a 24 h TTL (`SYNC_JOB_TTL_SECONDS`, `BACKFILL_STATE_TTL_SECONDS`). No Postgres table and no migration exist for them. The personal CSV queue is the exception: it needs durability across restarts and lives in Postgres.

**P3 — Progress is real counters, never time estimates.** `SyncJobAccount` carries `total`, `processed`, `inserted`, `categorized`, `uncategorized`. `overallProgress` returns `indeterminate` until every active account knows its total.

**P4 — Heartbeat decides liveness.** Every write sets `updatedAt`. A `running` job with no write for more than `SYNC_JOB_STALE_MS` (60 s) is shown as interrupted. A keep-alive every `SYNC_JOB_HEARTBEAT_MS` (15 s) covers slow GoCardless calls.

**P5 — Work is idempotent and resumable.** Bank transactions are inserted with `onConflictDoNothing` on `(account_id, external_id)`. Snapshots upsert per day. Notifications claim keys in `notification_log` before sending. Running the same work twice does not duplicate data.

**P6 — Work goes in blocks.** `SYNC_INSERT_CHUNK_SIZE = 50` rows per `INSERT`, with a progress report after each block.

**P7 — Domain functions take an optional `onProgress`.** `syncAccountLink(link, rateLimitStore, onProgress?)` and `backfillInstrument(..., onProgress)` work without a job. The cron path calls `syncAccountLinkObserved` with no progress callback. Progress errors are caught in `reportProgress` and never stop the sync.

**P8 — Never throw from `after()`.** `runSyncJob` uses `Promise.allSettled` per account, catches store errors, and always releases the account lock in `finally`.

**P9 — Crons are authenticated by a shared secret, not a session.** `/api/cron` is a public prefix in [`proxy.ts`](../../proxy.ts). Every cron route starts with `isAuthorizedCronRequest`, which compares `Bearer <CRON_SECRET>` in constant time and rejects a secret shorter than 32 characters.

**P10 — Destructive crons default to dry-run.** Every `*_MODE` parser maps an unknown or missing value to `dry-run`, never to `execute`.

## 3. Data model

| Store | Key or table | Content | Lifetime |
|---|---|---|---|
| Redis | `sync-job:<userId>:<jobId>` | Job meta: `id`, `kind`, `startedAt`, `updatedAt`, `dismissed`, `accountIds` | 24 h |
| Redis | `sync-job:<userId>:<jobId>:account:<accountId>` | One `SyncJobAccount` plus its own `updatedAt` | 24 h |
| Redis | `sync-jobs:<userId>` | Set of the user's job ids | 24 h, refreshed on each create |
| Redis | `sync-lock:<accountId>` | Per-account lock (`SET NX`) | 360 s (`SYNC_LOCK_TTL_SECONDS`) |
| Redis | `market:backfill:<instrumentId>` | `BackfillState` (`status`, `saved`, `total`, timestamps) | 24 h |
| Redis | `ops:sync-jobs:running` | Sorted set, member = jobId, score = last heartbeat in ms | Pruned at scrape after 24 h |
| Redis | `ops:heartbeat:cron:<cron>` | Epoch seconds of the last successful run | No TTL |
| Postgres | `personal_import_jobs` | Queue row: `status`, `lease`, `lease_until`, `attempts`, `available_at`, encrypted CSV and preview, `import_ledger`, notification timestamps | Until `expires_at` (7 days), then emptied and marked `expired` |
| Postgres | `notification_log` | One row per sent item key (dedupe for the notifications cron) | Purged after `NOTIFICATION_LOG_RETENTION_DAYS` (90) |

Job meta and accounts are separate keys on purpose: accounts of one job sync in parallel and each writes only its own key, so no update is lost. The job `status` and its heartbeat are computed on read in `assemble()`:

```text
status    = deriveJobStatus(accounts)
updatedAt = max(meta.updatedAt, account_1.updatedAt, ..., account_n.updatedAt)
```

`deriveJobStatus` returns `running` while any account is not in a final phase (`done`, `limited`, `expired`, `error`), `failed` when all accounts are `error`, and `done` otherwise.

## 4. How it works

### 4.1 Bank sync jobs

Two kinds exist (`SyncJobKind`):

| Kind | Started by | Response | Accounts |
|---|---|---|---|
| `manual-sync` | `POST /api/gocardless/accounts/[accountId]/sync` | `202 { jobId }` | One account |
| `initial-import` | `POST /api/gocardless/connections/[id]/finalize` | `201 { jobId }` | Every account created or relinked by the consent |

Manual sync request checks, in order:

| Check | Failure |
|---|---|
| Session | 401 |
| Link exists, belongs to the user, connection `linked` | 404 |
| `computeSyncEligibility` (shared budget) | 429 `{ status: "not-eligible", nextEligibleAt, syncsRemainingToday }` |
| `acquireAccountLock` throws | 503 `{ status: "unavailable" }` |
| Lock already held | 409 `{ status: "already-running" }` |
| `createJob` throws | 503, lock released |

The finalize route creates the job empty, writes the accounts, then calls `setAccounts`. An account whose lock is already held is added to the job directly as `phase: "error"`, `errorReason: "already-running"`, and is not synced again. If the lock cannot be read, finalize proceeds: the import is idempotent. After the job, a second `after()` releases previous GoCardless connections that a renewal replaced.

Account phases advance as follows:

```text
queued → balance → fetching → saving (total known, processed grows by 50) → done | limited | expired | error
```

`resultToPatch` maps a `SyncResult` to the final phase: `synced` → `done` with counters, `gocardless-limited` → `limited`, `expired` → `expired`. An exception becomes `error`.

Example. One account returns 120 transactions, 30 of which are already stored.

```text
saving  total=120 processed=0   inserted=0
saving  total=120 processed=50  inserted=50
saving  total=120 processed=100 inserted=90
saving  total=120 processed=120 inserted=90
done    inserted=90 categorized=72 uncategorized=18   (counts after the automatic categorisation pass)
```

### 4.2 Shared sync budget

Manual syncs and the cron share one budget per linked account (`lib/gocardless/sync-eligibility.ts`).

```text
used      = count of timestamps in the last 24 h (rolling window)
eligible  = used < 4  AND  now - lastSync >= 4 h
nextEligibleAt = max(lastSync + 4 h, oldestInWindow + 24 h if used = 4)
```

Example. Syncs at 08:00 and 13:00. At 15:00 `used = 2`, but `15:00 - 13:00 = 2 h < 4 h`, so the account is not eligible and `nextEligibleAt = 17:00`. `syncTimestamps` keeps at most 4 entries (`MAX_STORED_SYNC_TIMESTAMPS`).

### 4.3 Heartbeat and interruption

`runAccount` starts a `setInterval` that writes an empty patch every 15 s while `syncAccountLink` waits on GoCardless. `runSyncJob` also writes `ops.markJobRunning(jobId, now)` every 15 s and `markJobDone` at the end.

`toJobView(job, now)` marks a job interrupted when:

```text
job.status = running  AND  now - job.updatedAt > 60 000 ms
```

An interrupted job shows non-final accounts as `error` and gets `interrupted: true`. A job with no accounts becomes `failed`.

Example. The last write was at 10:00:00. At 10:00:45 the job is still running. At 10:01:01 it is shown as interrupted.

On k3s the app runs as a standalone Node server. The usual cause of an interruption is a pod shutdown during a rollout: the deployment has `terminationGracePeriodSeconds: 30`, so `after()` work still running after that is lost. The next sync resumes safely because inserts are idempotent. `maxDuration = 300` is exported on every route that uses `after()`.

### 4.4 Client polling and the global indicator

`useSyncJobsQuery` reads `GET /api/sync-jobs` (non-dismissed jobs only, already converted with `toJobView`). `refetchInterval` is `SYNC_JOBS_POLL_INTERVAL_MS` (1000 ms) while at least one job is `running`, and `false` otherwise.

`SyncProgressIndicator` is mounted once in [`app/(app)/layout.tsx`](../../app/(app)/layout.tsx), so progress survives navigation. It calls `useInvalidateOnSyncJobFinish`, which invalidates `["accounts"]`, `["gocardless", "connections", "status"]`, `["net-worth-snapshots"]` and the categorisation keys when:

- a job id that was `running` at the previous poll is no longer running (`hasFinishedSince`), or
- a job never seen before is already finished and started after the panel mounted (`hasNewlyFinishedJob`). This covers jobs that finish before the first poll.

`POST /api/sync-jobs/[id]/dismiss` sets `dismissed: true` so the summary card disappears.

### 4.5 Price history backfill

When an instrument with `priceMode = "auto"` lacks prices from a given date, `ensureHistory(instrument, fromKey, schedule)` starts a backfill through `schedule` (which is `after()` in routes):

1. `findFirstPriceDate` returns the first stored price. No work if it is on or before `fromKey`.
2. `redisBackfillStore.tryStart` refuses a second start while a live backfill runs. A stale one (no update for `BACKFILL_STALE_MS`, 60 s) may restart.
3. `backfillInstrument` reports `(done, total)`; each report writes `progress` and refreshes the heartbeat.
4. `finish` writes `done` or `failed` with the saved count.

The state is per instrument, not per user, because instruments are shared. `GET /api/instruments/backfill?ids=a,b` returns `BackfillStateView[]` only for instruments visible to the user (max 50 ids). `useBackfillStatusQuery` polls every 2 s (`BACKFILL_POLL_INTERVAL_MS`) while any state is running and not interrupted, then invalidates the investments overview. `useInstrumentPriceOnDateQuery` polls the same way while `loading` is true. Routes that call `ensureHistory` directly are `/api/instruments`, `/api/instruments/[id]/price`, `/quotation`, `/watch`, `/api/investments/transactions`, `/api/investments/transactions/[id]`, `/api/investments/portfolio`, `/api/investments/statements/[id]` and `/api/investments/import`; `/api/instruments/[id]/analysis` reaches it through [`lib/investments/title-view.ts`](../../lib/investments/title-view.ts).

### 4.6 Fire-and-forget tasks in `after()`

Some routes hand short work to `after()` without a job record. The client sees the effect by refetching.

| Route | Task | Guard |
|---|---|---|
| `POST /api/transactions/categorize-suggestions/generate` | `categorizeNewMovementsSafely(userId, ..., { maxGroups, budgetMs })` | Requires AI consent and `OPENROUTER_API_KEY`; time budget `MANUAL_RUN_BUDGET_MS` |
| `PATCH /api/user/ai-categorization` (when `autoApply` turns on) | `autoApplyCategoriesSafely` | None needed: never throws |
| `POST /api/investments/import` (statement with new cash rows) | `categorizeNewMovementsSafely` | Never throws |
| `POST /api/personal-imports/[id]` (confirm) | `categorizeNewMovementsSafely` | Never throws |
| `GET /api/investments/overview` | `ensureProfilesSafely`, `ensureDividendsSafely` | One attempt per instrument per hour (`market:profile-attempt:*`, `market:dividends-attempt:*`) |

### 4.7 Personal CSV import queue

The personal CSV import is a durable queue in Postgres, processed by a separate process, not by `after()`. The reason is that AI analysis and the parser sandbox can take minutes and must survive restarts.

| Step | Code | Detail |
|---|---|---|
| Enqueue | `enqueue` in `lib/personal-import/jobs.ts` | Advisory lock per user; at most 2 jobs in `queued`/`processing` and 10 uploads per 24 h; CSV sealed with `PERSONAL_CSV_ENCRYPTION_KEY`; `expires_at = now + 7 days` |
| Claim | `processOne` in `lib/personal-import/worker.ts` | `SELECT ... FOR UPDATE SKIP LOCKED` on `queued` with `available_at <= now()`, or `processing` with an expired lease; sets a new `lease` UUID and `lease_until = now + 5 min`; `attempts + 1`, fails after 3 |
| Save | `maintainJobs` | Confirms one `ready` job atomically; a validation error becomes `review_failed`; any other error retries after 60 s |
| Notify | `maintainJobs` | Claims one finished job with `notified_at IS NULL` and `notify_after <= now()`, pushes `notify_after` by 15 min before sending |
| Expire | `maintainJobs` | Clears encrypted CSV and preview of jobs past `expires_at` |

The loop in [`scripts/personal-csv-worker.ts`](../../scripts/personal-csv-worker.ts) runs `maintainJobs()` then `processOne()`; it sleeps 5 s when there is nothing to do and stops on `SIGTERM`. It runs as the `csv-worker` Docker target, deployed as `buddy-budget-csv-worker` in the infra repo with `terminationGracePeriodSeconds: 360`. The client polls `usePersonalImportsQuery` every 3 s (`PERSONAL_IMPORT_POLL_INTERVAL_MS`) while a job is `queued`, `processing` or `ready`; `PersonalImportIsland` shows it next to the sync panel in the app layout. Details are in [`docs/personal-csv-import.md`](../personal-csv-import.md).

### 4.8 Crons

Every cron route is a `GET` wrapped in `withRoute("cron.<name>", ...)`, with `export const dynamic = "force-dynamic"` and `maxDuration = 300`. The shape is the same in all seven:

```text
if not isAuthorizedCronRequest(header, CRON_SECRET): return 401
startedAt = now
try   result = run(...)
catch recordCronRun(name, "error", ...); return 500 { ok: false }
outcome = failures > 0 ? "error" : "success"
recordCronRun(name, outcome, duration, { store: redisOpsStore, log })
return 200 or 500 with counts only (never user data)
```

`recordCronRun` increments `buddybudget_cron_runs_total{cron,outcome}`, logs `cron.<name>.completed` or `cron.<name>.failed`, and, on success only, writes `ops:heartbeat:cron:<name>`. The heartbeat is exported at scrape time as `buddybudget_cron_last_success_timestamp_seconds{cron}` and feeds the "cron did not run" alerts. A heartbeat write failure is logged as `cron.heartbeat.write_failed` and does not fail the cron.

Schedules (UTC; the CronJobs set no `timeZone`):

| Cron (`CronName`) | Route | k8s schedule | Compose | What it does | Mode env var |
|---|---|---|---|---|---|
| `market_prices` | `/api/cron/market-prices` | `30 6,17,22 * * *` | Yes | `updateHeldInstruments` (closes and FX), inflation index for each area in `INFLATION_AREAS`, crypto catalog, €STR risk-free rate, stale profiles and dividends, `evaluatePriceAlerts` | None |
| `net_worth_snapshot` | `/api/cron/net-worth-snapshot` | `50 6,17,23 * * *` | Yes | `runDailySnapshots`: per user with accounts or investment transactions, rebuild missing history, then upsert today's cash and investment snapshot | None |
| `gocardless_sync` | `/api/cron/gocardless-sync` | `0 */12 * * *` | Only with `GOCARDLESS_SECRET_ID` | `runDueSyncs`: links with `next_sync_eligible_at <= now`, connection `linked`, user not scheduled for deletion; skips ineligible or locked accounts | None |
| `gocardless_maintenance` | `/api/cron/gocardless-maintenance` | `15 4 * * *` | Only with `GOCARDLESS_SECRET_ID` | Marks expired connections, sends consent notices, purges old attempts, then cleanup on GoCardless | `GOCARDLESS_CLEANUP_MODE` (`off`/`dry-run`/`execute`), `GOCARDLESS_CLEANUP_DELETE_UNKNOWN`, `GOCARDLESS_CLEANUP_APPROVED_REQUISITIONS` |
| `account_deletion` | `/api/cron/account-deletion` | `30 3 * * *` | Yes | `purgeDueAccountDeletions` (accounts past `deletion_scheduled_at`), then `purgeExpiredAuthData` (expired sessions and verifications) | None |
| `inactive_accounts` | `/api/cron/inactive-accounts` | `15 3 * * *` | No | Warn after 83 days without activity, delete 7 days after the warning | `INACTIVITY_CLEANUP_MODE` (`off`/`dry-run`/`execute`) |
| `notifications` | `/api/cron/notifications` | `30 7 * * *` | No | Digest, budget alerts, instalment alerts, goal reminders for users who opted in | `NOTIFICATIONS_MODE` (`off`/`dry-run`/`execute`) |
| `public_demo` | `/api/cron/public-demo` | `0 4 * * *` | No | `resetPublicDemos`: deletes and re-seeds the four shared read-only demo accounts (`public-demo-<country>-<language>`: it-it, it-en, de-en, de-de; `lib/public-demo`) so dates follow today | `PUBLIC_DEMO_ENABLED` (`true` to turn it on; otherwise it answers `skipped` without a heartbeat) |

Order matters for two pairs. `market-prices` runs 20 minutes before `net-worth-snapshot` (06:30 then 06:50, 17:30 then 17:50, 22:30 then 23:50), because snapshots value investments at the prices just written. `inactive-accounts` runs before `account-deletion`.

In the cluster each CronJob is a `curlimages/curl` pod that calls `http://buddy-budget.app.svc.cluster.local:3000/api/cron/<name>` with `curl -sf --retry 3 --retry-delay 2 --retry-connrefused` and `backoffLimit: 3`. curl retries on HTTP 500, and a failed pod is recreated, so a cron that answers 500 may run again within minutes. All crons are written to tolerate this (P5).

### 4.9 Dry-run and execute

| Mode | `gocardless_maintenance` | `inactive_accounts` | `notifications` |
|---|---|---|---|
| `off` | Marks expired and sends notices; no cleanup | Returns zero counts | Returns zero counts |
| `dry-run` (default) | Cleanup counts what it would delete | Counts `wouldWarn`, `wouldDelete`; no writes, no email | Counts `wouldSend`, logs `notifications.email.dry_run`; no claim, no send |
| `execute` | Deletes on GoCardless, at most `MAX_DELETIONS_PER_RUN` (25) | Writes warnings, sends emails, deletes; at most `INACTIVITY_MAX_ACTIONS_PER_RUN` (50) warnings and 50 deletions per run | Claims keys, sends, releases keys on failure |

Cleanup grace periods (`DEFAULT_CLEANUP_POLICY`): abandoned attempts 3 days, orphan connections 7 days, expired connections 30 days, unknown requisitions 30 days.

### 4.10 Inactivity timeline

```text
warnAt   = lastActiveAt + (90 - 7) days
deleteAt = max(lastActiveAt + 90 days, warnedAt + 7 days)
returned = warnedAt set AND lastActiveAt > warnedAt
```

Example. Last activity on 1 March. The warning is due on 23 May (83 days). If the cron was down and the warning went out on 25 May, deletion is due on 1 June (25 May + 7), not on 30 May. A sign-in after the warning clears it (`returned`). Each candidate is reloaded right before acting. Accounts with an exemption reason are counted as `exempt` and skipped.

### 4.11 Notifications dedupe

In `execute`, `deliver` first inserts the item keys into `notification_log` with `onConflictDoNothing`. If fewer keys come back than requested, another process owns them: the claimed ones are released and nothing is sent. If the send fails, all claimed keys are deleted so the next run retries. The run stops early after `RUN_TIME_BUDGET_MS` (240 s) and sets `timedOut: true`, staying inside `maxDuration`.

## 5. Limits and out of scope

- Only GoCardless sync uses the full job standard (Redis job, per-account counters, global panel). Price backfills have their own lighter state. AI suggestion runs and «Ricategorizza» have no job record or progress.
- `runDueSyncs` has no time budget inside `maxDuration`; with many due accounts the request can outlive it. This is listed in CLAUDE.md "Known technical debt".
- The GoCardless cron syncs accounts one after another inside the request, without `after()` (comment in the route: the job standard applies to user-triggered work).
- The self-hosting compose file does not schedule `inactive-accounts` or `notifications`.
- `account_deletion` and `net_worth_snapshot` have no dry-run mode.
- A job lost to a pod shutdown is not resumed automatically; the user starts a new sync, and idempotent inserts make that safe.
- `maxDuration` does not stop work on the standalone Node server; only a pod shutdown does.

## 6. Tests

| File | Asserts |
|---|---|
| [`lib/sync-jobs/store.test.ts`](../../lib/sync-jobs/store.test.ts) | Job creation and listing, patches ignore `undefined`, concurrent account updates are not lost, isolation between users, exclusive lock |
| [`lib/sync-jobs/run.test.ts`](../../lib/sync-jobs/run.test.ts) | Parallel accounts with isolated errors and released locks, no throw when the store fails, heartbeat during a slow call, ops running/done markers, trigger mapping |
| [`lib/sync-jobs/view.test.ts`](../../lib/sync-jobs/view.test.ts) | `deriveJobStatus`, interruption after 60 s, `overallProgress` determinate/indeterminate |
| [`app/api/gocardless/accounts/[accountId]/sync/route.test.ts`](../../app/api/gocardless/accounts/[accountId]/sync/route.test.ts) | 404, 429, 202 with background completion, 409, 503 with lock release |
| [`app/api/sync-jobs/route.test.ts`](../../app/api/sync-jobs/route.test.ts) | Listing and dismissed filtering |
| [`lib/market-data/backfill-state.test.ts`](../../lib/market-data/backfill-state.test.ts) | No double start while alive, restart when stale, progress and finish |
| [`lib/gocardless/scheduler.test.ts`](../../lib/gocardless/scheduler.test.ts) | Due-link selection, one sync per due link, shared budget respected |
| [`lib/net-worth/scheduler.test.ts`](../../lib/net-worth/scheduler.test.ts) | User selection, history rebuilt before the daily snapshot |
| [`lib/cron/auth.test.ts`](../../lib/cron/auth.test.ts) | Exact bearer accepted; missing, wrong or short secret rejected |
| [`lib/observability/ops-store.test.ts`](../../lib/observability/ops-store.test.ts) | Cron heartbeat only on success, heartbeat failure does not fail the cron, active vs stale job counts |
| `app/api/cron/*/route.test.ts` (seven files) | 401 without the secret, 500 on failure; for the three mode crons, dry-run by default and mode parsing |
| [`lib/notifications/run.test.ts`](../../lib/notifications/run.test.ts), [`lib/account/inactivity.test.ts`](../../lib/account/inactivity.test.ts), [`lib/gocardless/cleanup.test.ts`](../../lib/gocardless/cleanup.test.ts) | Mode behaviour, caps, dedupe and decisions of the three dry-run crons |
| [`lib/personal-import/import.integration.test.ts`](../../lib/personal-import/import.integration.test.ts) | Queue processing against a real database |

## 7. Related

- [overview.md](overview.md) — the whole system
- [bank-sync-and-imports.md](bank-sync-and-imports.md) — what `syncAccountLink` and the importers do with the data
- [market-data.md](market-data.md) — price chain, backfill, profiles, dividends
- [net-worth.md](net-worth.md) — snapshot contents
- [categorisation.md](categorisation.md) — the automatic categorisation pass after sync and import
- Decisions: [`2026-10-10-email-riepilogo-e-avvisi.md`](../decisioni/2026-10-10-email-riepilogo-e-avvisi.md), [`2026-10-11-account-inattivi.md`](../decisioni/2026-10-11-account-inattivi.md), [`2026-10-08-csv-personali.md`](../decisioni/2026-10-08-csv-personali.md), [`2026-10-10-self-hosting-docker.md`](../decisioni/2026-10-10-self-hosting-docker.md)
- Specs: [`2026-09-22-gocardless-sync-job-progress-design.md`](../superpowers/specs/2026-09-22-gocardless-sync-job-progress-design.md), [`2026-09-27-osservabilita-app-fase-a-design.md`](../superpowers/specs/2026-09-27-osservabilita-app-fase-a-design.md)
