# Fast GoCardless import/sync with visible progress (background job)

Date: 2026-09-22
Replaces: `2026-09-10-gocardless-sync-performance-design.md` (never implemented, superseded by rule-based categorization).
First use case of the "Operazioni lunghe" ("Long operations") standard in `CLAUDE.md` (Architecture principles section).

## Problem

1. When confirming the "Conti trovati" ("Found accounts") (`app/(app)/conti/collega/[connectionId]/page.tsx`) the transaction import is extremely slow and the user is left in front of a disabled button without knowing what is happening.
2. Manual sync of an account (button in `AccountRow`) is also extremely slow, with only a spinning icon as feedback.

The user wants **real, granular** progress ("Importati 120 di 500 movimenti" — "Imported 120 of 500 transactions") that **stays visible when changing page**.

## Cause (from the code)

- `syncAccountLink` (`lib/gocardless/sync.ts`) runs **one `INSERT` per transaction, sequentially**: N transactions = N round-trips to Postgres (Neon, remote from the function).
- `POST /api/gocardless/connections/[id]/finalize` syncs the selected accounts **one after the other** inside the HTTP request.
- Every GoCardless call rereads the token from the DB (`getAccessToken`).
- `flushRuleHits` runs one `UPDATE` per rule sequentially (minor impact).
- **Not optimizable**: the latency of the GoCardless APIs (balance + transactions), which on real banks can take seconds per account.

Categorization is already in memory (`buildRuleResolver`) and must not be touched.

## Deployment constraint

The app currently runs on **Vercel + Neon** (serverless) and will stay there for a while; in the future maybe on a VPS with persistent Node. The solution must work in both cases: no long-lived in-memory processes, no Vercel-only infrastructure.

## Approaches evaluated

- **Chosen — `after()` + state on Redis + polling.** The route creates a job, responds with `{ jobId }` and works in `after()` (`next/server`) up to `maxDuration`. Works on Vercel and on persistent Node.
- Discarded — Vercel Workflow/Queues: more robust, but Vercel lock-in and disproportionate for a few seconds of work.
- Discarded — the client drives the work in chunks: survives only as long as the tab stays open, moves logic to the client.
- Discarded — response streaming: lost when changing page.

State on **Redis** (already used for rate limiting) and not Postgres: ephemeral state with TTL, no migration (also avoids the known `db:push` blocker on `transactions_account_external_id_unique`).

## Design

### 1. Job model (`lib/sync-jobs/`)

```ts
export type SyncJobKind = "initial-import" | "manual-sync";
export type SyncJobStatus = "running" | "done" | "failed";
export type SyncAccountPhase =
  | "queued" | "balance" | "fetching" | "saving"
  | "done" | "limited" | "expired" | "error";

export interface SyncJobAccount {
  accountId: string;
  name: string;
  phase: SyncAccountPhase;
  total: number | null;      // known only after the download from GoCardless
  processed: number;         // rows processed (inserted + already present)
  inserted: number;          // new rows
  categorized: number;
  uncategorized: number;
  errorReason?: "already-running"; // account already syncing elsewhere (finalize only)
}

export interface SyncJob {
  id: string;
  userId: string;
  kind: SyncJobKind;
  status: SyncJobStatus;
  dismissed: boolean;
  startedAt: string;         // ISO
  updatedAt: string;         // ISO, heartbeat
  accounts: SyncJobAccount[];
}
```

**Store** (`lib/sync-jobs/store.ts`) behind a minimal `SyncJobStore` interface (like `RateLimitStore`), with a Redis adapter (`redis-sync-job-store.ts`) and an in-memory fake for tests:

- job metadata: `sync-job:{userId}:{jobId}` → `{ id, userId, kind, startedAt, updatedAt, dismissed, accountIds }` (JSON, TTL 24h);
- **one key per account**: `sync-job:{userId}:{jobId}:account:{accountId}` → `SyncJobAccount` + `updatedAt` (TTL 24h, renewed on every update). Reason (which emerged while writing the plan): accounts sync in parallel, and a single JSON updated with read-modify-write by several accounts would lose updates; with separate keys each account writes only its own;
- index: `sync-jobs:{userId}` (set of jobIds, same TTL);
- per-account lock: `sync-lock:{accountId}` via `SET NX EX`, TTL = `maxDuration` + 60s.

The job's `status` and `updatedAt` **are not stored**: they are computed on read (`updatedAt` = the most recent between metadata and accounts).

Operations: `createJob`, `setAccounts(userId, jobId, accounts)`, `updateAccount(userId, jobId, accountId, patch)` (updates the account's `updatedAt`; `undefined` fields in the patch don't overwrite), `listJobs(userId)`, `dismissJob(userId, jobId)`, `acquireAccountLock(accountId)`, `releaseAccountLock(accountId)`.

`status` is derived from the accounts: `running` as long as at least one account is not in a final phase (`done`/`limited`/`expired`/`error`) or as long as the job has no accounts yet; then `failed` if **all** are `error`, otherwise `done`.

**Pure functions** (`lib/sync-jobs/view.ts`):
- `toJobView(job, now)`: if `status === "running"` and `now - updatedAt > SYNC_JOB_STALE_MS` (60s), returns the job as interrupted (`interrupted: true`, non-final accounts in `error` phase, status recomputed; a job without accounts becomes `failed`);
- `overallProgress(job)`: `{ kind: "complete" }` if the job is not `running`; `{ kind: "determinate", processed, total }` when every non-final account already has `total` (final accounts without `total`, e.g. `limited`, don't count); otherwise `{ kind: "indeterminate" }`.

### 2. `syncAccountLink` (`lib/gocardless/sync.ts`)

Extended, backward-compatible signature:

```ts
export interface SyncProgress {
  phase: "balance" | "fetching" | "saving";
  total?: number;
  processed?: number;
  inserted?: number;
  categorized?: number;
  uncategorized?: number;
}

export async function syncAccountLink(
  link: SyncableLink,
  rateLimitStore: RateLimitStore,
  onProgress?: (progress: SyncProgress) => Promise<void> | void
): Promise<SyncResult>
```

- Emits `balance` before the balance call and `fetching` before the transactions call.
- Resolves category/split in memory for all transactions (unchanged), then inserts in **chunks of `SYNC_INSERT_CHUNK_SIZE = 50`**:
  ```ts
  db.insert(transactions).values(chunk)
    .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
    .returning({ externalId: transactions.externalId, categoryId: transactions.categoryId })
  ```
- Counters are computed from the returned rows. `recordHit(ruleId)` only for the returned `externalId`s (rows actually inserted), via an `externalId → ruleId` map built during resolution.
- After each chunk it emits `saving` with `total`, `processed` (cumulative), `inserted`, `categorized`, `uncategorized`.
- An `onProgress` error is logged and ignored: it never interrupts the sync.
- `SyncResult` unchanged. The scheduler (`lib/gocardless/scheduler.ts`) keeps calling it without a callback.

**GoCardless token**: module-level in-memory cache in `client.ts` (value + expiry), checked before the DB query. It is valid for the lifetime of the instance; the DB cache remains the shared source.

**`flushRuleHits`**: per-rule updates run with `Promise.all` instead of sequentially.

### 3. Orchestrator (`lib/sync-jobs/run.ts`)

```ts
export async function runSyncJob(job: SyncJob, links: SyncableLink[], deps): Promise<void>
```

For each account, **in parallel** (`Promise.allSettled`):
1. `syncAccountLink(link, rateLimitStore, (p) => store.updateAccount(job.id, link.accountId, mapProgress(p)))`;
2. maps the outcome: `synced` → `done` with the final counts, `gocardless-limited` → `limited`, `expired` → `expired`, exception → `error` (logged);
3. releases the account lock in a `finally`.

### 4. Routes

Both export `export const maxDuration = 300`.

**`POST /api/gocardless/connections/[id]/finalize`**, in order:
1. session, connection ownership, Zod validation, ownership of `existing` accounts (unchanged);
2. `createJob` on Redis with `accounts: []` — **if Redis fails, 503 before creating any account**;
3. creation/update of accounts and links (unchanged), then `setAccounts(jobId, …)` with the real `accountId`s in `queued` phase (if this write fails: log and continue, the sync starts anyway and the job will be seen as interrupted — data remains correct);
4. lock acquisition (an account already syncing, only possible for an `existing` one, goes straight to `error` with the message "già in corso" ("already in progress"));
5. `after(() => runSyncJob(...))`;
6. response `201 { jobId }`.

**`POST /api/gocardless/accounts/[accountId]/sync`**:
1. session, ownership, eligibility (unchanged; 404/429 as today);
2. `acquireAccountLock` — if taken, **409 `{ status: "already-running" }`**;
3. `createJob` (503 if Redis fails, releasing the lock);
4. `after(() => runSyncJob(...))`;
5. response `202 { jobId }`.

**`GET /api/sync-jobs`**: non-`dismissed` jobs of the user in session, already passed through `toJobView`.

**`POST /api/sync-jobs/[id]/dismiss`**: marks `dismissed` only if the key `sync-job:{userId}:{id}` exists for the user in session (404 otherwise). No other user's job is ever readable or modifiable.

### 5. Client (`lib/queries/sync-jobs.ts`)

- `useSyncJobsQuery()`: fetch on mount, `refetchInterval: 1000` only while at least one `running` job exists, otherwise `false`.
- When a job goes from `running` to a final state: invalidates `accounts`, `transactions`, `bank-connections` (and the derived queries already invalidated today by the manual sync).
- `useDismissSyncJobMutation()`.
- `useFinalizeConnectionMutation` and `useSyncAccountMutation` invalidate `sync-jobs` on `onSuccess`. The success toast of the manual sync is **removed** (the feedback is in the panel). Toasts remain for synchronous errors: `not-eligible`, `already-running` ("Sincronizzazione già in corso" — "Sync already in progress"), 503, `unknown`.

### 6. UI (`components/domain/sync/`)

**`SyncProgressPanel`**, mounted in `app/(app)/layout.tsx` next to `AppShell` (the layout stays domain-agnostic). Visible if at least one non-`dismissed` job exists. Floating panel at the bottom right on desktop, full width at the bottom on mobile.

- **Compact:** "Sincronizzazione · N conti" ("Sync · N accounts") (or "Sincronizzazione completata" — "Sync completed") + overall bar (`overallProgress`).
- **Expanded** (click/Enter): one `SyncAccountProgressRow` per account.

Texts per phase (pure function `describeAccountProgress`, named constants):

| Phase | Text | Bar |
|---|---|---|
| queued | In attesa ("Waiting") | none |
| balance | Aggiorno il saldo… ("Updating the balance…") | indeterminate |
| fetching | Scarico i movimenti dalla banca… ("Downloading transactions from the bank…") | indeterminate |
| saving | Importati {processed} di {total} movimenti ("Imported {processed} of {total} transactions") | determinate |
| done | {inserted} nuovi · {categorized} categorizzati · {uncategorized} da categorizzare ("{inserted} new · {categorized} categorized · {uncategorized} to categorize") (or "Nessun movimento nuovo. Saldo aggiornato." — "No new transactions. Balance updated.") | full |
| limited / expired | existing messages from `sync-messages.ts` | none |
| error | "Sincronizzazione non riuscita. Riprova più tardi." ("Sync failed. Try again later.") (or the "interrotta" ("interrupted") message if `interrupted`) | none |

- If `uncategorized > 0` at the end of the job: "Categorizza" ("Categorize") link to `/categorizza`.
- Close button (X) visible only when the job has finished → `dismiss`.
- Correct singular/plural (reusing `pluralize`).
- Accessibility: `role="progressbar"` with `aria-valuenow/min/max` on determinate bars, `aria-busy` on indeterminate ones, final summary in `aria-live="polite"`, indeterminate bar animations behind `motion-safe:`.
- Colors only from theme tokens.

**"Conti trovati" page**: while pending, "Conferma" ("Confirm") becomes "Avvio…" ("Starting…"). On `onSuccess` it goes to `/conti` as today (now immediately).

**`AccountRow`**: the sync icon spins and is disabled if that `accountId` appears in a `running` job (derived from `useSyncJobsQuery`, not from `syncMutation.isPending`), with `title` "Sincronizzazione in corso" ("Sync in progress").

## What does NOT change

- Rule-based categorization logic, direction guard, split.
- Postgres schema.
- Import idempotency (unique constraint `(accountId, externalId)`).
- Shared sync budget 4/day + 4h gap (`computeSyncEligibility`) and update of `syncTimestamps` at the end of a successful sync.
- Cron scheduler (no functional change).

## Out of scope (debt noted in CLAUDE.md)

- On Vercel the `node-cron` scheduler in `instrumentation.ts` doesn't run: automatic syncs every 12h and net worth snapshots don't start. Migration to Vercel Cron in a dedicated session.
- Automatically resuming an interrupted job (today: a message, then the next sync picks up thanks to idempotency).

## Tests (vitest)

- `lib/gocardless/sync.test.ts`: 120 transactions → 3 chunks, correct counts; second run → 0 new (idempotency); `onProgress` sequence (`balance`, `fetching`, `saving` with `processed` 50/100/120); `hitCount` incremented only for inserted rows; exception in `onProgress` doesn't interrupt the sync; call without callback unchanged.
- `lib/sync-jobs/store.test.ts` (in-memory fake): create/update/list/dismiss, `status` derivation, lock acquired/denied/released, isolation between users.
- `lib/sync-jobs/view.test.ts`: stall beyond 60s → interrupted; `overallProgress` determinate only with all `total`s.
- `lib/sync-jobs/run.test.ts`: accounts in parallel, one account in error doesn't block the others, lock always released, outcome mapping.
- `components/domain/sync/describe-account-progress.test.ts`: texts per phase, plurals.
- Routes (`after()` mocked to run immediately): finalize → `201 { jobId }`, 503 with Redis down and no account created; sync → `202 { jobId }`, 409 with the lock taken; `GET /api/sync-jobs` doesn't return other users' jobs; dismiss of someone else's job → 404.

## Manual verification by the user (no real browser/Postgres in the sandbox)

- On Vercel: link a sandbox bank with several accounts, confirm, change page during the sync: the panel stays and the counter advances.
- Correct final summary, "Categorizza" link, close persists after refresh.
- Manual sync: double click / second tab → "già in corso"; icon spinning even if the sync started elsewhere.
- Balances and lists updated by themselves at the end of the job.
- Import time before/after on an account with many transactions.
