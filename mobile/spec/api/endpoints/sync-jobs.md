# Sync jobs (bank import / sync progress polling)

Feature area(s): global "sync in progress" panel (all screens), Liquidity > Accounts (per-account syncing indicator), after bank connection finalize
Source: `app/api/sync-jobs/route.ts`, `app/api/sync-jobs/[id]/dismiss/route.ts`, `lib/sync-jobs/{types,store,redis-store,view,run}.ts`, client usage `lib/queries/sync-jobs.ts`

Scope: this store is used ONLY by GoCardless bank jobs (`POST /api/gocardless/connections/{id}/finalize` and `POST /api/gocardless/accounts/{accountId}/sync`). Personal CSV imports use a different, DB-backed job model (see personal-imports.md). The cron auto-sync does not create jobs (it only uses the per-account lock).

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/sync-jobs` | All non-dismissed jobs of the user (≤ 24 h old), with heartbeat evaluated | session | poll target |
| POST | `/api/sync-jobs/{id}/dismiss` | Hide a job summary (on every device) | session | — |

There is NO `GET /api/sync-jobs/{id}`: find your `jobId` in the list.

## Data model (verbatim from `lib/sync-jobs/types.ts`)

```ts
type SyncJobKind = "initial-import" | "manual-sync";
type SyncJobStatus = "running" | "done" | "failed";
type SyncAccountPhase =
  | "queued" | "balance" | "fetching" | "saving"     // in progress
  | "done" | "limited" | "expired" | "error";        // FINAL_PHASES

interface SyncJobAccount {
  accountId: string;
  name: string;
  phase: SyncAccountPhase;
  total: number | null;     // transactions to process; known only after download (phase "saving")
  processed: number;        // processed so far (new + already present)
  inserted: number;         // new transactions actually inserted
  categorized: number;
  uncategorized: number;
  errorReason?: "already-running";   // only for an account skipped because another sync held its lock
}

interface SyncJobView {
  id: string;               // uuid (= jobId returned by the start endpoints)
  userId: string;
  kind: SyncJobKind;
  status: SyncJobStatus;    // DERIVED, see below
  dismissed: boolean;       // always false in GET output (dismissed jobs are filtered)
  startedAt: string;        // ISO
  updatedAt: string;        // ISO heartbeat = max(meta.updatedAt, every account.updatedAt)
  accounts: SyncJobAccount[];
  interrupted: boolean;     // true if running but no heartbeat for > 60 s
}
```
All counters are JSON numbers.

### Phase progression per account
`queued` → `balance` (fetching balance) → `fetching` (downloading transactions) → `saving` (with `total`, `processed`, `inserted`, `categorized`, `uncategorized` updated after each insert chunk) → final:
- `done`: sync OK; final `inserted`, `categorized`, `uncategorized` are the counts AFTER the automatic categorization pass (rules + AI auto-apply).
- `limited`: GoCardless rate limit for this account (`gocardless-limited`) — retry later.
- `expired`: bank consent expired (GoCardless 401) — connection set to `expired`; user must reconnect.
- `error`: unexpected failure, or `errorReason: "already-running"`, or forced by the stale rule.

### Derived job status (`deriveJobStatus`)
- no accounts → `running`
- any account not in a final phase → `running`
- all accounts `error` → `failed`
- otherwise → `done` (mixed `done`/`limited`/`expired`/`error` counts as `done`; inspect accounts for partial failures)

### Heartbeat / stale rule (`toJobView`)
- `SYNC_JOB_STALE_MS = 60_000`: if `status === "running"` and `now - updatedAt > 60 s`, the view sets `interrupted: true`, turns every non-final account into `phase: "error"`, and recomputes status (`failed` if no accounts, else derived). This is evaluated server-side at read time (server clock).
- `SYNC_JOB_HEARTBEAT_MS = 15_000`: while an account is waiting on slow GoCardless calls the runner touches the account key every 15 s, so a healthy job never looks stale.
- An interrupted job is final from the client's point of view (data already written stays; a new manual sync may be started once eligible).

### Storage, TTL, locks
- Redis keys: `sync-job:{userId}:{jobId}` (meta), `sync-job:{userId}:{jobId}:account:{accountId}` (one per account), index set `sync-jobs:{userId}`. Every write refreshes TTL `SYNC_JOB_TTL_SECONDS = 86400` (24 h) — jobs vanish from the list 24 h after their last update even if never dismissed.
- Per-account lock `sync-lock:{accountId}` (`SET NX EX 360`, `SYNC_LOCK_TTL_SECONDS = 360` = route maxDuration 300 s + margin), released when the account finishes.
- `hasActiveSync(userId)` (= any job `running` and not `interrupted`) blocks `POST /api/user/reset` and `DELETE /api/user/account` with 409.

## GET /api/sync-jobs
Route name: `sync_jobs.list` · Auth: session cookie required

**Response** `200` — `SyncJobView[]`, sorted by `startedAt` desc, dismissed jobs excluded.
```json
[{
  "id": "7c2e5b1a-8f0e-4a51-9d2a-0b7e1c3d4f56",
  "userId": "u_8Hq2…",
  "kind": "initial-import",
  "status": "running",
  "dismissed": false,
  "startedAt": "2026-10-18T09:30:00.000Z",
  "updatedAt": "2026-10-18T09:30:12.000Z",
  "interrupted": false,
  "accounts": [
    { "accountId": "1d7e…", "name": "Conto Fineco", "phase": "saving", "total": 412, "processed": 200,
      "inserted": 198, "categorized": 150, "uncategorized": 48 },
    { "accountId": "9a01…", "name": "Conto Risparmio", "phase": "error", "total": null, "processed": 0,
      "inserted": 0, "categorized": 0, "uncategorized": 0, "errorReason": "already-running" }
  ]
}]
```
**Errors**: `401` empty; `503 { error: "Stato della sincronizzazione non disponibile" }` (Redis down).

**Headers**: no explicit `Cache-Control` set (unverified framework default; dynamic route).

## POST /api/sync-jobs/{id}/dismiss
Route name: `sync_jobs.dismiss` · Auth: session cookie required

**Path params**: `id` — job id. **Request body**: none.

**Response** `204`. Sets `dismissed: true` in the meta key (TTL refreshed to 24 h). Dismissing a running job is allowed (it just disappears from the list; the sync continues).

**Errors**: `404` empty (job not found for this user / expired); `503` EMPTY body (Redis error); `401` empty.

## Polling contract (as implemented by web)
- Poll `GET /api/sync-jobs` every `SYNC_JOBS_POLL_INTERVAL_MS = 1000` ms only while at least one job has `status === "running"`; otherwise stop polling (fetch on app focus / after starting a job).
- After a start endpoint returns `{ jobId }`, fetch the list immediately and start polling.
- When a job leaves `running` — or a never-seen job appears already finished with `startedAt` after the screen mounted (it finished before the first poll) — invalidate: accounts, bank connections status, net-worth snapshots, categorization queue/suggestions data.
- Overall progress (`overallProgress`): if job not running → complete; if any non-final account has `total === null` → indeterminate; else determinate with `sum(processed) / sum(total)` (accounts with `total === null` but final are skipped; `total === 0` overall → indeterminate).
- "Account is syncing" (`isAccountSyncing`): exists a `running` job containing that account in a non-final phase.
- Summary toast/message after `done` (web `buildSyncSummaryMessage`, Italian): `inserted === 0` → "Nessuna nuova transazione trovata. Saldo aggiornato."; else "`N` nuove transazioni (`c` categorizzate da sole, `u` da decidere). Saldo aggiornato.".
- Closing the summary card calls dismiss.

**Mobile notes**: jobs run in Next `after()` on the server — the app can be backgrounded; resume polling on foreground. No push notification when a job finishes. Treat `interrupted: true` as a failure state for non-final accounts.
