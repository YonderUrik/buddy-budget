# GoCardless sync as a background job with progress — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the import of the "Conti trovati" (Accounts found) and the manual sync fast (chunked inserts, accounts in parallel) and run them as background jobs with a global panel showing real progress ("Importati 120 di 500 movimenti" — "Imported 120 of 500 transactions") on any page.

**Architecture:** The routes create a job on Redis, respond immediately with `{ jobId }` and do the work in Next.js `after()`. `syncAccountLink` inserts in chunks of 50 and reports progress via a callback; an orchestrator (`runSyncJob`) writes the progress to Redis (one key per account). The client polls `GET /api/sync-jobs` every second only while a job is running, from a panel mounted in the `(app)` layout.

**Tech Stack:** Next.js 16.2 (App Router, `after` from `next/server`), Drizzle ORM on Postgres (Neon), ioredis 5, TanStack Query, vitest 4, Tailwind v4 + shadcn/ui (`@base-ui/react`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-22-gocardless-sync-job-progress-design.md`

## Global Constraints

- Current deploy: **Vercel serverless + Neon**. No long-lived in-memory processes; background work goes only through `after()`.
- Every route that starts background work exports `export const maxDuration = 300;` (literal: Next reads it statically).
- Job state **only on Redis**, 24h TTL (`SYNC_JOB_TTL_SECONDS = 86400`). No changes to the Postgres schema, no `db:push`.
- Heartbeat: a `running` job with `updatedAt` older than `SYNC_JOB_STALE_MS = 60_000` → interrupted.
- Per-account lock: `sync-lock:{accountId}`, TTL `SYNC_LOCK_TTL_SECONDS = 360` (maxDuration 300 + 60).
- Chunked inserts of `SYNC_INSERT_CHUNK_SIZE = 50`.
- Client polling: `SYNC_JOBS_POLL_INTERVAL_MS = 1000`, active only with at least one `running` job.
- No hardcoded hex colors or radii in components: only theme tokens (`bg-primary`, `text-muted-foreground`, `text-destructive`, `text-pos`, etc.).
- Visible text in Italian, as named constants (not literals scattered in the JSX).
- One-line JSDoc on every public function/component.
- Redis keys for jobs always prefixed with `userId`: no reading/writing of another user's jobs.
- Unchanged: rule-based categorisation, direction guard, split, `(accountId, externalId)` idempotency, sync budget 4/day + 4h gap, `SyncResult`.
- DB tests run against the real Postgres in `.env.local` (`fileParallelism: false` already configured); command: `pnpm test <file>`.
- 3 tests in `lib/gocardless/scheduler.test.ts` already fail before this plan (pre-existing, unrelated): they must not be "fixed" here, but the number of failures must not grow.

## Review Focus

1. **Two accounts writing the same job in parallel** — no lost updates (one key per account). Test in Task 2 (concurrent `updateAccount` on two accounts).
2. **Resync with history already imported** — "Importati X di Y" counts the processed rows, while the final summary counts only the new ones (`inserted`), without inflating `hitCount`. Test in Task 3.
3. **Function killed halfway (Vercel timeout)** — the job shows as interrupted after 60s, it doesn't run forever. Test in Task 1 (`toJobView`).
4. **Double click / second tab on manual sync** — 409 "already running", no second call to GoCardless. Test in Task 6.
5. **Redis unreachable when confirming the Conti trovati** — 503 before creating any account (no orphan accounts). Test in Task 7.

---

## File Structure

**New**
- `lib/sync-jobs/types.ts` — job types, constants, `queuedAccount`, `deriveJobStatus` (client-safe, no server imports).
- `lib/sync-jobs/view.ts` — pure presentation functions: `toJobView`, `overallProgress`, `isAccountSyncing`, `runningJobIds`, `hasFinishedSince` (client-safe).
- `lib/sync-jobs/store.ts` — `SyncJobKv` (KV primitives), `createSyncJobStore(kv)`, `createMemorySyncJobKv()` (for tests).
- `lib/sync-jobs/redis-store.ts` — ioredis adapter + `redisSyncJobStore` instance (server-only).
- `lib/sync-jobs/run.ts` — `runSyncJob` orchestrator + `progressToPatch`/`resultToPatch`.
- `app/api/sync-jobs/route.ts` — `GET` the user's jobs.
- `app/api/sync-jobs/[id]/dismiss/route.ts` — `POST` to close the summary.
- `lib/queries/sync-jobs.ts` — `useSyncJobsQuery`, `useInvalidateOnSyncJobFinish`, `useDismissSyncJobMutation`.
- `components/domain/sync/describe-account-progress.ts` — texts/bars per phase (pure, tested).
- `components/domain/sync/progress-bar.tsx`, `sync-account-progress-row.tsx`, `sync-progress-panel.tsx`, `sync-progress-indicator.tsx`, `index.ts`.

**Modified**
- `lib/gocardless/sync.ts` — chunked inserts + `onProgress`.
- `lib/gocardless/client.ts` — in-memory token cache.
- `lib/categorization/resolve.ts` — `flushRuleHits` in parallel.
- `lib/gocardless/scheduler.ts` — uses the per-account lock.
- `lib/gocardless/sync-messages.ts` — new `already-running`/`unavailable` errors.
- `app/api/gocardless/accounts/[accountId]/sync/route.ts`, `app/api/gocardless/connections/[id]/finalize/route.ts` — job + `after()`.
- `lib/queries/gocardless.ts` — mutations adapted to jobs.
- `app/(app)/layout.tsx`, `app/(app)/conti/page.tsx`, `app/(app)/conti/collega/[connectionId]/page.tsx`, `components/domain/accounts/account-row.tsx`.
- `CLAUDE.md` — project status + log.

---

### Task 1: Job types and pure view functions

**Files:**
- Create: `lib/sync-jobs/types.ts`
- Create: `lib/sync-jobs/view.ts`
- Test: `lib/sync-jobs/view.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SyncJobKind = "initial-import" | "manual-sync"`
  - `type SyncJobStatus = "running" | "done" | "failed"`
  - `type SyncAccountPhase = "queued" | "balance" | "fetching" | "saving" | "done" | "limited" | "expired" | "error"`
  - `FINAL_PHASES: ReadonlySet<SyncAccountPhase>`
  - `interface SyncJobAccount { accountId; name; phase; total: number | null; processed; inserted; categorized; uncategorized; errorReason?: "already-running" }`
  - `type SyncJobAccountPatch = Partial<Omit<SyncJobAccount, "accountId" | "name">>`
  - `interface SyncJob { id; userId; kind; status; dismissed; startedAt: string; updatedAt: string; accounts: SyncJobAccount[] }`
  - `interface SyncJobView extends SyncJob { interrupted: boolean }`
  - constants `SYNC_JOB_TTL_SECONDS`, `SYNC_JOB_STALE_MS`, `SYNC_LOCK_TTL_SECONDS`
  - `queuedAccount(accountId: string, name: string): SyncJobAccount`
  - `deriveJobStatus(accounts: SyncJobAccount[]): SyncJobStatus`
  - `toJobView(job: SyncJob, now: Date): SyncJobView`
  - `type OverallProgress = { kind: "complete" } | { kind: "determinate"; processed: number; total: number } | { kind: "indeterminate" }`
  - `overallProgress(job: SyncJob): OverallProgress`
  - `isAccountSyncing(jobs: SyncJob[], accountId: string): boolean`
  - `runningJobIds(jobs: SyncJob[] | undefined): Set<string>`
  - `hasFinishedSince(previous: Set<string>, current: Set<string>): boolean`

- [ ] **Step 1: Write the types**

`lib/sync-jobs/types.ts`:

```ts
/** Kind of work that originated the job: import after "Conti trovati" or manual sync of an account. */
export type SyncJobKind = "initial-import" | "manual-sync";

export type SyncJobStatus = "running" | "done" | "failed";

export type SyncAccountPhase =
  | "queued"
  | "balance"
  | "fetching"
  | "saving"
  | "done"
  | "limited"
  | "expired"
  | "error";

/** Phases after which an account no longer changes state. */
export const FINAL_PHASES: ReadonlySet<SyncAccountPhase> = new Set(["done", "limited", "expired", "error"]);

/** Lifetime of a job's state on Redis. */
export const SYNC_JOB_TTL_SECONDS = 24 * 60 * 60;
/** Beyond this interval without updates a "running" job is considered interrupted. */
export const SYNC_JOB_STALE_MS = 60_000;
/** TTL of the per-account lock: maxDuration of the routes (300s) + margin. */
export const SYNC_LOCK_TTL_SECONDS = 360;

export interface SyncJobAccount {
  accountId: string;
  name: string;
  phase: SyncAccountPhase;
  /** Transactions to process: known only after the download from GoCardless. */
  total: number | null;
  /** Transactions processed (new + already present). */
  processed: number;
  /** New transactions actually inserted. */
  inserted: number;
  categorized: number;
  uncategorized: number;
  /** Reason for an `error` known in advance (account already syncing elsewhere). */
  errorReason?: "already-running";
}

export type SyncJobAccountPatch = Partial<Omit<SyncJobAccount, "accountId" | "name">>;

export interface SyncJob {
  id: string;
  userId: string;
  kind: SyncJobKind;
  status: SyncJobStatus;
  dismissed: boolean;
  startedAt: string;
  /** Heartbeat: most recent update among metadata and accounts. */
  updatedAt: string;
  accounts: SyncJobAccount[];
}

/** Job ready for the client: `interrupted` flags a job left without a heartbeat. */
export interface SyncJobView extends SyncJob {
  interrupted: boolean;
}

/** Account just added to a job, waiting to start. */
export function queuedAccount(accountId: string, name: string): SyncJobAccount {
  return { accountId, name, phase: "queued", total: null, processed: 0, inserted: 0, categorized: 0, uncategorized: 0 };
}

/** Job status derived from the accounts: running until an account is not final, failed only if all are in error. */
export function deriveJobStatus(accounts: SyncJobAccount[]): SyncJobStatus {
  if (accounts.length === 0) return "running";
  if (accounts.some((account) => !FINAL_PHASES.has(account.phase))) return "running";
  return accounts.every((account) => account.phase === "error") ? "failed" : "done";
}
```

- [ ] **Step 2: Write the tests (they fail: `view.ts` does not exist)**

`lib/sync-jobs/view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveJobStatus, queuedAccount, type SyncJob, type SyncJobAccount } from "./types";
import { hasFinishedSince, isAccountSyncing, overallProgress, runningJobIds, toJobView } from "./view";

function account(overrides: Partial<SyncJobAccount> = {}): SyncJobAccount {
  return { ...queuedAccount("acc-1", "Conto"), ...overrides };
}

function job(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: "job-1",
    userId: "user-1",
    kind: "manual-sync",
    status: "running",
    dismissed: false,
    startedAt: "2026-09-22T10:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
    accounts: [account()],
    ...overrides,
  };
}

describe("deriveJobStatus", () => {
  it("è running senza conti o con almeno un conto non finale", () => {
    expect(deriveJobStatus([])).toBe("running");
    expect(deriveJobStatus([account({ phase: "done" }), account({ phase: "saving" })])).toBe("running");
  });

  it("è failed solo se tutti i conti sono in errore, altrimenti done", () => {
    expect(deriveJobStatus([account({ phase: "error" }), account({ phase: "error" })])).toBe("failed");
    expect(deriveJobStatus([account({ phase: "error" }), account({ phase: "limited" })])).toBe("done");
  });
});

describe("toJobView", () => {
  const now = new Date("2026-09-22T10:00:30.000Z");

  it("lascia intatto un job con heartbeat recente", () => {
    const view = toJobView(job(), now);
    expect(view.interrupted).toBe(false);
    expect(view.status).toBe("running");
  });

  it("marca interrotto un job running senza heartbeat da oltre 60s", () => {
    const stale = job({
      updatedAt: "2026-09-22T09:59:00.000Z",
      accounts: [account({ accountId: "a", phase: "done" }), account({ accountId: "b", phase: "saving" })],
    });
    const view = toJobView(stale, now);
    expect(view.interrupted).toBe(true);
    expect(view.accounts.map((a) => a.phase)).toEqual(["done", "error"]);
    expect(view.status).toBe("done");
  });

  it("un job interrotto senza conti diventa failed", () => {
    const view = toJobView(job({ updatedAt: "2026-09-22T09:00:00.000Z", accounts: [] }), now);
    expect(view.interrupted).toBe(true);
    expect(view.status).toBe("failed");
  });

  it("non considera interrotto un job già concluso, anche se vecchio", () => {
    const view = toJobView(job({ status: "done", updatedAt: "2026-09-22T08:00:00.000Z" }), now);
    expect(view.interrupted).toBe(false);
  });
});

describe("overallProgress", () => {
  it("è complete per un job concluso", () => {
    expect(overallProgress(job({ status: "done" }))).toEqual({ kind: "complete" });
  });

  it("è indeterminate finché un conto non finale non ha un totale", () => {
    const running = job({ accounts: [account({ phase: "fetching" }), account({ phase: "saving", total: 10, processed: 5 })] });
    expect(overallProgress(running)).toEqual({ kind: "indeterminate" });
  });

  it("somma processed/total ignorando i conti finali senza totale", () => {
    const running = job({
      accounts: [
        account({ phase: "saving", total: 100, processed: 50 }),
        account({ phase: "done", total: 20, processed: 20 }),
        account({ phase: "limited", total: null }),
      ],
    });
    expect(overallProgress(running)).toEqual({ kind: "determinate", processed: 70, total: 120 });
  });
});

describe("isAccountSyncing", () => {
  it("è true solo per un conto non finale di un job running", () => {
    const jobs = [job({ accounts: [account({ accountId: "a", phase: "saving" }), account({ accountId: "b", phase: "done" })] })];
    expect(isAccountSyncing(jobs, "a")).toBe(true);
    expect(isAccountSyncing(jobs, "b")).toBe(false);
    expect(isAccountSyncing(jobs, "c")).toBe(false);
    expect(isAccountSyncing([job({ status: "done", accounts: [account({ accountId: "a", phase: "saving" })] })], "a")).toBe(false);
  });
});

describe("runningJobIds / hasFinishedSince", () => {
  it("rileva un job che non è più running rispetto al poll precedente", () => {
    const before = runningJobIds([job({ id: "x" }), job({ id: "y", status: "done" })]);
    expect(before).toEqual(new Set(["x"]));
    expect(hasFinishedSince(before, runningJobIds([job({ id: "x", status: "done" })]))).toBe(true);
    expect(hasFinishedSince(before, runningJobIds([job({ id: "x" })]))).toBe(false);
    expect(runningJobIds(undefined)).toEqual(new Set());
  });
});
```

- [ ] **Step 3: Check that they fail**

Run: `pnpm test lib/sync-jobs/view.test.ts`
Expected: FAIL, `Failed to resolve import "./view"`.

- [ ] **Step 4: Implement `view.ts`**

`lib/sync-jobs/view.ts`:

```ts
import {
  FINAL_PHASES,
  SYNC_JOB_STALE_MS,
  deriveJobStatus,
  type SyncJob,
  type SyncJobView,
} from "./types";

export type OverallProgress =
  | { kind: "complete" }
  | { kind: "determinate"; processed: number; total: number }
  | { kind: "indeterminate" };

/** Prepares a job for the client: a running job without a heartbeat for more than 60s is shown as interrupted. */
export function toJobView(job: SyncJob, now: Date): SyncJobView {
  const isStale = job.status === "running" && now.getTime() - Date.parse(job.updatedAt) > SYNC_JOB_STALE_MS;
  if (!isStale) return { ...job, interrupted: false };

  const accounts = job.accounts.map((account) =>
    FINAL_PHASES.has(account.phase) ? account : { ...account, phase: "error" as const }
  );
  return {
    ...job,
    accounts,
    status: accounts.length === 0 ? "failed" : deriveJobStatus(accounts),
    interrupted: true,
  };
}

/** Overall progress: determinate only when every still-active account knows its own total. */
export function overallProgress(job: SyncJob): OverallProgress {
  if (job.status !== "running") return { kind: "complete" };

  let processed = 0;
  let total = 0;
  for (const account of job.accounts) {
    if (account.total === null) {
      if (FINAL_PHASES.has(account.phase)) continue;
      return { kind: "indeterminate" };
    }
    processed += account.processed;
    total += account.total;
  }
  if (total === 0) return { kind: "indeterminate" };
  return { kind: "determinate", processed, total };
}

/** True if the account is syncing in a job still in progress. */
export function isAccountSyncing(jobs: SyncJob[], accountId: string): boolean {
  return jobs.some(
    (job) =>
      job.status === "running" &&
      job.accounts.some((account) => account.accountId === accountId && !FINAL_PHASES.has(account.phase))
  );
}

/** Ids of the jobs still in progress, to compare two successive polls. */
export function runningJobIds(jobs: SyncJob[] | undefined): Set<string> {
  return new Set((jobs ?? []).filter((job) => job.status === "running").map((job) => job.id));
}

/** True if at least one job that was in progress at the previous poll no longer is. */
export function hasFinishedSince(previous: Set<string>, current: Set<string>): boolean {
  for (const id of previous) {
    if (!current.has(id)) return true;
  }
  return false;
}
```

- [ ] **Step 5: Check that they pass**

Run: `pnpm test lib/sync-jobs/view.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Commit**

```bash
git add lib/sync-jobs/types.ts lib/sync-jobs/view.ts lib/sync-jobs/view.test.ts
git commit -m "feat: tipi e vista pura dei job di sync"
```

---

### Task 2: Job store (abstract KV, in-memory fake, Redis adapter)

**Files:**
- Create: `lib/sync-jobs/store.ts`
- Create: `lib/sync-jobs/redis-store.ts`
- Test: `lib/sync-jobs/store.test.ts`

**Interfaces:**
- Consumes (Task 1): `SyncJob`, `SyncJobAccount`, `SyncJobAccountPatch`, `SyncJobKind`, `deriveJobStatus`, `SYNC_JOB_TTL_SECONDS`, `SYNC_LOCK_TTL_SECONDS`.
- Produces:
  - `interface SyncJobKv { get(key): Promise<string | null>; set(key, value, ttlSeconds): Promise<void>; setIfAbsent(key, value, ttlSeconds): Promise<boolean>; del(key): Promise<void>; addToSet(key, member, ttlSeconds): Promise<void>; setMembers(key): Promise<string[]> }`
  - `interface SyncJobStore { createJob(input: { userId: string; kind: SyncJobKind; accounts?: SyncJobAccount[] }): Promise<SyncJob>; setAccounts(userId, jobId, accounts: SyncJobAccount[]): Promise<void>; updateAccount(userId, jobId, accountId, patch: SyncJobAccountPatch): Promise<void>; listJobs(userId): Promise<SyncJob[]>; dismissJob(userId, jobId): Promise<boolean>; acquireAccountLock(accountId): Promise<boolean>; releaseAccountLock(accountId): Promise<void> }`
  - `createSyncJobStore(kv: SyncJobKv, clock?: () => Date): SyncJobStore`
  - `createMemorySyncJobKv(): SyncJobKv`
  - `redisSyncJobStore: SyncJobStore` (from `lib/sync-jobs/redis-store.ts`)

- [ ] **Step 1: Write the tests (they fail: `store.ts` does not exist)**

`lib/sync-jobs/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { queuedAccount } from "./types";
import { createMemorySyncJobKv, createSyncJobStore, type SyncJobStore } from "./store";

describe("createSyncJobStore", () => {
  let store: SyncJobStore;
  let now: Date;

  beforeEach(() => {
    now = new Date("2026-09-22T10:00:00.000Z");
    store = createSyncJobStore(createMemorySyncJobKv(), () => now);
  });

  it("crea un job running con i conti in coda e lo elenca", async () => {
    const job = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [queuedAccount("a", "Conto A")] });
    expect(job.status).toBe("running");
    expect(job.startedAt).toBe("2026-09-22T10:00:00.000Z");

    const jobs = await store.listJobs("u1");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].accounts[0]).toMatchObject({ accountId: "a", name: "Conto A", phase: "queued" });
  });

  it("aggiorna un conto ignorando i campi undefined e avanza l'heartbeat", async () => {
    const job = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [queuedAccount("a", "Conto A")] });
    now = new Date("2026-09-22T10:00:05.000Z");
    await store.updateAccount("u1", job.id, "a", { phase: "saving", total: 100, processed: 50 });
    now = new Date("2026-09-22T10:00:06.000Z");
    await store.updateAccount("u1", job.id, "a", { phase: "saving", total: undefined, processed: 100 });

    const [stored] = await store.listJobs("u1");
    expect(stored.accounts[0]).toMatchObject({ phase: "saving", total: 100, processed: 100 });
    expect(stored.updatedAt).toBe("2026-09-22T10:00:06.000Z");
  });

  it("non perde aggiornamenti concorrenti di due conti dello stesso job", async () => {
    const job = await store.createJob({
      userId: "u1",
      kind: "initial-import",
      accounts: [queuedAccount("a", "A"), queuedAccount("b", "B")],
    });
    await Promise.all([
      store.updateAccount("u1", job.id, "a", { phase: "done", inserted: 3 }),
      store.updateAccount("u1", job.id, "b", { phase: "done", inserted: 7 }),
    ]);
    const [stored] = await store.listJobs("u1");
    expect(stored.accounts.map((a) => a.inserted)).toEqual([3, 7]);
    expect(stored.status).toBe("done");
  });

  it("setAccounts popola un job creato vuoto", async () => {
    const job = await store.createJob({ userId: "u1", kind: "initial-import" });
    expect(job.accounts).toEqual([]);
    await store.setAccounts("u1", job.id, [queuedAccount("a", "A")]);
    const [stored] = await store.listJobs("u1");
    expect(stored.accounts.map((a) => a.accountId)).toEqual(["a"]);
  });

  it("isola i job tra utenti, anche per dismiss", async () => {
    const job = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [queuedAccount("a", "A")] });
    expect(await store.listJobs("u2")).toEqual([]);
    expect(await store.dismissJob("u2", job.id)).toBe(false);
    expect(await store.dismissJob("u1", job.id)).toBe(true);
    expect((await store.listJobs("u1"))[0].dismissed).toBe(true);
  });

  it("ordina i job dal più recente", async () => {
    const first = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [] });
    now = new Date("2026-09-22T10:05:00.000Z");
    const second = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [] });
    expect((await store.listJobs("u1")).map((j) => j.id)).toEqual([second.id, first.id]);
  });

  it("il lock per conto è esclusivo finché non viene rilasciato", async () => {
    expect(await store.acquireAccountLock("a")).toBe(true);
    expect(await store.acquireAccountLock("a")).toBe(false);
    expect(await store.acquireAccountLock("b")).toBe(true);
    await store.releaseAccountLock("a");
    expect(await store.acquireAccountLock("a")).toBe(true);
  });
});
```

- [ ] **Step 2: Check that they fail**

Run: `pnpm test lib/sync-jobs/store.test.ts`
Expected: FAIL, `Failed to resolve import "./store"`.

- [ ] **Step 3: Implement `store.ts`**

`lib/sync-jobs/store.ts`:

```ts
import {
  SYNC_JOB_TTL_SECONDS,
  SYNC_LOCK_TTL_SECONDS,
  deriveJobStatus,
  type SyncJob,
  type SyncJobAccount,
  type SyncJobAccountPatch,
  type SyncJobKind,
} from "./types";

/** Minimal KV primitives the job store runs on — Redis in production, a Map in tests. */
export interface SyncJobKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Writes only if the key does not exist; true if it wrote. */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
  addToSet(key: string, member: string, ttlSeconds: number): Promise<void>;
  setMembers(key: string): Promise<string[]>;
}

export interface SyncJobStore {
  createJob(input: { userId: string; kind: SyncJobKind; accounts?: SyncJobAccount[] }): Promise<SyncJob>;
  setAccounts(userId: string, jobId: string, accounts: SyncJobAccount[]): Promise<void>;
  updateAccount(userId: string, jobId: string, accountId: string, patch: SyncJobAccountPatch): Promise<void>;
  listJobs(userId: string): Promise<SyncJob[]>;
  dismissJob(userId: string, jobId: string): Promise<boolean>;
  acquireAccountLock(accountId: string): Promise<boolean>;
  releaseAccountLock(accountId: string): Promise<void>;
}

interface StoredJobMeta {
  id: string;
  userId: string;
  kind: SyncJobKind;
  startedAt: string;
  updatedAt: string;
  dismissed: boolean;
  accountIds: string[];
}

interface StoredJobAccount extends SyncJobAccount {
  updatedAt: string;
}

const jobKey = (userId: string, jobId: string) => `sync-job:${userId}:${jobId}`;
const accountKey = (userId: string, jobId: string, accountId: string) =>
  `sync-job:${userId}:${jobId}:account:${accountId}`;
const indexKey = (userId: string) => `sync-jobs:${userId}`;
const lockKey = (accountId: string) => `sync-lock:${accountId}`;

function withoutUndefined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/**
 * Sync job store. Metadata and accounts live in separate keys: the accounts of a job
 * sync in parallel and each one writes only its own key, so no update
 * is lost. Job status and heartbeat are computed on read.
 */
export function createSyncJobStore(kv: SyncJobKv, clock: () => Date = () => new Date()): SyncJobStore {
  async function readMeta(userId: string, jobId: string): Promise<StoredJobMeta | null> {
    const raw = await kv.get(jobKey(userId, jobId));
    return raw ? (JSON.parse(raw) as StoredJobMeta) : null;
  }

  async function writeAccounts(userId: string, jobId: string, accounts: SyncJobAccount[], now: string) {
    await Promise.all(
      accounts.map((account) =>
        kv.set(accountKey(userId, jobId, account.accountId), JSON.stringify({ ...account, updatedAt: now }), SYNC_JOB_TTL_SECONDS)
      )
    );
  }

  async function assemble(meta: StoredJobMeta): Promise<SyncJob> {
    const rawAccounts = await Promise.all(meta.accountIds.map((id) => kv.get(accountKey(meta.userId, meta.id, id))));
    const stored = rawAccounts.filter((raw): raw is string => raw !== null).map((raw) => JSON.parse(raw) as StoredJobAccount);
    const updatedAt = stored.reduce((latest, account) => (account.updatedAt > latest ? account.updatedAt : latest), meta.updatedAt);
    const accounts: SyncJobAccount[] = stored.map(({ updatedAt: _ignored, ...account }) => account);
    return {
      id: meta.id,
      userId: meta.userId,
      kind: meta.kind,
      status: deriveJobStatus(accounts),
      dismissed: meta.dismissed,
      startedAt: meta.startedAt,
      updatedAt,
      accounts,
    };
  }

  return {
    async createJob({ userId, kind, accounts = [] }) {
      const now = clock().toISOString();
      const meta: StoredJobMeta = {
        id: crypto.randomUUID(),
        userId,
        kind,
        startedAt: now,
        updatedAt: now,
        dismissed: false,
        accountIds: accounts.map((account) => account.accountId),
      };
      await kv.set(jobKey(userId, meta.id), JSON.stringify(meta), SYNC_JOB_TTL_SECONDS);
      await writeAccounts(userId, meta.id, accounts, now);
      await kv.addToSet(indexKey(userId), meta.id, SYNC_JOB_TTL_SECONDS);
      return assemble(meta);
    },

    async setAccounts(userId, jobId, accounts) {
      const meta = await readMeta(userId, jobId);
      if (!meta) return;
      const now = clock().toISOString();
      await writeAccounts(userId, jobId, accounts, now);
      const updated: StoredJobMeta = { ...meta, updatedAt: now, accountIds: accounts.map((account) => account.accountId) };
      await kv.set(jobKey(userId, jobId), JSON.stringify(updated), SYNC_JOB_TTL_SECONDS);
    },

    async updateAccount(userId, jobId, accountId, patch) {
      const key = accountKey(userId, jobId, accountId);
      const raw = await kv.get(key);
      if (!raw) return;
      const current = JSON.parse(raw) as StoredJobAccount;
      const next: StoredJobAccount = { ...current, ...withoutUndefined(patch), updatedAt: clock().toISOString() };
      await kv.set(key, JSON.stringify(next), SYNC_JOB_TTL_SECONDS);
    },

    async listJobs(userId) {
      const ids = await kv.setMembers(indexKey(userId));
      const metas = await Promise.all(ids.map((id) => readMeta(userId, id)));
      const jobs = await Promise.all(metas.filter((meta): meta is StoredJobMeta => meta !== null).map(assemble));
      return jobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },

    async dismissJob(userId, jobId) {
      const meta = await readMeta(userId, jobId);
      if (!meta) return false;
      await kv.set(jobKey(userId, jobId), JSON.stringify({ ...meta, dismissed: true }), SYNC_JOB_TTL_SECONDS);
      return true;
    },

    acquireAccountLock: (accountId) => kv.setIfAbsent(lockKey(accountId), "1", SYNC_LOCK_TTL_SECONDS),

    releaseAccountLock: (accountId) => kv.del(lockKey(accountId)),
  };
}

/** In-memory KV for tests (no expiry: tests don't depend on it). */
export function createMemorySyncJobKv(): SyncJobKv {
  const values = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async setIfAbsent(key, value) {
      if (values.has(key)) return false;
      values.set(key, value);
      return true;
    },
    async del(key) {
      values.delete(key);
    },
    async addToSet(key, member) {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
    },
    async setMembers(key) {
      return [...(sets.get(key) ?? [])];
    },
  };
}
```

Note: `startedAt` uses an ISO string, so `localeCompare` sorts correctly by date.

- [ ] **Step 4: Implement the Redis adapter**

`lib/sync-jobs/redis-store.ts`:

```ts
import "server-only";
import { redis } from "@/lib/redis/client";
import { createSyncJobStore, type SyncJobKv } from "./store";

/** ioredis adapter of `SyncJobKv`. */
const redisSyncJobKv: SyncJobKv = {
  get: (key) => redis.get(key),
  async set(key, value, ttlSeconds) {
    await redis.set(key, value, "EX", ttlSeconds);
  },
  async setIfAbsent(key, value, ttlSeconds) {
    return (await redis.set(key, value, "EX", ttlSeconds, "NX")) === "OK";
  },
  async del(key) {
    await redis.del(key);
  },
  async addToSet(key, member, ttlSeconds) {
    await redis.multi().sadd(key, member).expire(key, ttlSeconds).exec();
  },
  setMembers: (key) => redis.smembers(key),
};

/** Sync job store used by the routes and the scheduler. */
export const redisSyncJobStore = createSyncJobStore(redisSyncJobKv);
```

- [ ] **Step 5: Check tests and types**

Run: `pnpm test lib/sync-jobs/store.test.ts` → Expected: PASS.
Run: `pnpm exec tsc --noEmit` → Expected: no errors in the `lib/sync-jobs/*` files.

- [ ] **Step 6: Commit**

```bash
git add lib/sync-jobs/store.ts lib/sync-jobs/redis-store.ts lib/sync-jobs/store.test.ts
git commit -m "feat: store Redis dei job di sync con chiavi per conto e lock"
```

---

### Task 3: `syncAccountLink` with chunked inserts and `onProgress`

**Files:**
- Modify: `lib/gocardless/sync.ts` (whole body of the `try`, lines ~42-137)
- Test: `lib/gocardless/sync.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `SYNC_INSERT_CHUNK_SIZE = 50`
  - `interface SyncProgress { phase: "balance" | "fetching" | "saving"; total?: number; processed?: number; inserted?: number; categorized?: number; uncategorized?: number }`
  - `type SyncProgressCallback = (progress: SyncProgress) => Promise<void> | void`
  - `syncAccountLink(link: SyncableLink, rateLimitStore: RateLimitStore, onProgress?: SyncProgressCallback): Promise<SyncResult>` (backward-compatible signature)

- [ ] **Step 1: Add the tests at the end of `describe("syncAccountLink")`**

In `lib/gocardless/sync.test.ts`, add the import `SYNC_INSERT_CHUNK_SIZE, type SyncProgress` to the existing import from `./sync`:

```ts
import { SYNC_INSERT_CHUNK_SIZE, syncAccountLink, type SyncableLink, type SyncProgress } from "./sync";
```

Add the helper right below `createMemoryStore`:

```ts
function mockBankResponses(count: number) {
  vi.mocked(getAccountBalances).mockResolvedValue({
    balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
    rateLimit: null,
  });
  vi.mocked(getAccountTransactions).mockResolvedValue({
    transactions: Array.from({ length: count }, (_, index) => ({
      internalTransactionId: `bulk-${index}`,
      transactionAmount: { amount: "-1.00", currency: "EUR" },
      remittanceInformationUnstructured: `Movimento ${index}`,
      bookingDate: "2026-07-01",
    })),
    rateLimit: null,
  });
}
```

And these tests before the closing of the `describe`:

```ts
  it("importa a blocchi e notifica l'avanzamento con processed cumulativo", async () => {
    expect(SYNC_INSERT_CHUNK_SIZE).toBe(50);
    mockBankResponses(120);
    const progress: SyncProgress[] = [];

    const result = await syncAccountLink(link, createMemoryStore(), (p) => {
      progress.push(p);
    });

    expect(result).toMatchObject({ status: "synced", newTransactionsCount: 120, uncategorizedCount: 120 });
    expect(progress.map((p) => p.phase)).toEqual(["balance", "fetching", "saving", "saving", "saving", "saving"]);
    expect(progress.filter((p) => p.phase === "saving").map((p) => p.processed)).toEqual([0, 50, 100, 120]);
    expect(progress.at(-1)).toEqual({
      phase: "saving",
      total: 120,
      processed: 120,
      inserted: 120,
      categorized: 0,
      uncategorized: 120,
    });

    const stored = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored).toHaveLength(120);
  });

  it("in un resync conta come elaborate anche le righe già presenti, ma come nuove solo quelle inserite", async () => {
    mockBankResponses(60);
    await syncAccountLink(link, createMemoryStore());

    mockBankResponses(61);
    const progress: SyncProgress[] = [];
    const result = await syncAccountLink(link, createMemoryStore(), (p) => {
      progress.push(p);
    });

    expect(result).toMatchObject({ status: "synced", newTransactionsCount: 1 });
    expect(progress.at(-1)).toMatchObject({ total: 61, processed: 61, inserted: 1 });
  });

  it("un errore nella callback di avanzamento non interrompe il sync", async () => {
    mockBankResponses(3);
    const result = await syncAccountLink(link, createMemoryStore(), () => {
      throw new Error("Redis giù");
    });
    expect(result).toMatchObject({ status: "synced", newTransactionsCount: 3 });
  });
```

- [ ] **Step 2: Check that they fail**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: FAIL. `SYNC_INSERT_CHUNK_SIZE` not exported (undefined) and no progress calls.

- [ ] **Step 3: Implement**

In `lib/gocardless/sync.ts`:

1. Change the import of the transactions schema:

```ts
import { transactions, type NewTransaction } from "@/lib/db/schema/transactions";
```

2. Below `const MAX_STORED_SYNC_TIMESTAMPS = 4;` add:

```ts
/** Rows per single INSERT: big enough to avoid one query per transaction, small enough to give granular progress. */
export const SYNC_INSERT_CHUNK_SIZE = 50;

/** Progress of a sync, reported at every phase and after every saved chunk. */
export interface SyncProgress {
  phase: "balance" | "fetching" | "saving";
  total?: number;
  processed?: number;
  inserted?: number;
  categorized?: number;
  uncategorized?: number;
}

export type SyncProgressCallback = (progress: SyncProgress) => Promise<void> | void;

/** Progress is informational: an error in it (e.g. Redis down) must never interrupt the sync. */
async function reportProgress(onProgress: SyncProgressCallback | undefined, progress: SyncProgress): Promise<void> {
  if (!onProgress) return;
  try {
    await onProgress(progress);
  } catch (error) {
    console.error("Aggiornamento dell'avanzamento del sync fallito", error);
  }
}
```

3. Replace the signature and the JSDoc:

```ts
/**
 * Syncs balance and transactions of a linked account; updates the timestamps or marks the connection expired.
 * `onProgress` (optional) receives the phases and, during saving, the counters after each chunk.
 */
export async function syncAccountLink(
  link: SyncableLink,
  rateLimitStore: RateLimitStore,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
```

4. Inside the `try`, before `const { balance, rateLimit: balanceRateLimit } = await getAccountBalances(...)`:

```ts
    await reportProgress(onProgress, { phase: "balance" });
```

and before `const { transactions: bankTransactions, ... } = await getAccountTransactions(...)`:

```ts
    await reportProgress(onProgress, { phase: "fetching" });
```

5. Replace the whole block from `const fallbackCategoryId = await getFallbackCategoryId(link.userId);` up to and including `await flushRuleHits(ruleResolver.appliedRuleIds());` with:

```ts
    const fallbackCategoryId = await getFallbackCategoryId(link.userId);
    const ruleResolver = await buildRuleResolver(link.userId);

    const rows: NewTransaction[] = [];
    const ruleIdByExternalId = new Map<string, string>();
    for (const bankTransaction of bankTransactions) {
      const externalId = bankTransaction.internalTransactionId ?? bankTransaction.transactionId;
      if (!externalId) continue;

      const rawDescription = bankTransaction.remittanceInformationUnstructured ?? null;
      const isExpense = Number(bankTransaction.transactionAmount.amount) < 0;
      const merchantName = (isExpense ? bankTransaction.creditorName : bankTransaction.debtorName)?.trim();
      const description = merchantName || rawDescription || "Movimento bancario";
      const amount = Number(bankTransaction.transactionAmount.amount);
      const resolved = ruleResolver.resolve({ description, amount });
      if (resolved) ruleIdByExternalId.set(externalId, resolved.ruleId);

      rows.push({
        userId: link.userId,
        accountId: link.accountId,
        categoryId: resolved?.categoryId ?? fallbackCategoryId,
        description,
        rawDescription,
        amount: bankTransaction.transactionAmount.amount,
        excludedAmount: (resolved?.excludedAmount ?? 0).toFixed(2),
        date: bankTransaction.bookingDate,
        source: "auto",
        externalId,
      });
    }

    let newTransactionsCount = 0;
    let categorizedCount = 0;
    let uncategorizedCount = 0;
    await reportProgress(onProgress, {
      phase: "saving",
      total: rows.length,
      processed: 0,
      inserted: 0,
      categorized: 0,
      uncategorized: 0,
    });

    for (let start = 0; start < rows.length; start += SYNC_INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(start, start + SYNC_INSERT_CHUNK_SIZE);
      const insertedRows = await db
        .insert(transactions)
        .values(chunk)
        .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
        .returning({ externalId: transactions.externalId, categoryId: transactions.categoryId });

      for (const inserted of insertedRows) {
        newTransactionsCount += 1;
        // hitCount must be incremented only for rows actually written: GoCardless returns a rolling
        // window of history, so the same transaction (discarded here by onConflictDoNothing in later
        // syncs) must not artificially inflate the usage of the rule that categorised it.
        const ruleId = inserted.externalId ? ruleIdByExternalId.get(inserted.externalId) : undefined;
        if (ruleId) ruleResolver.recordHit(ruleId);
        if (inserted.categoryId === fallbackCategoryId) {
          uncategorizedCount += 1;
        } else {
          categorizedCount += 1;
        }
      }

      await reportProgress(onProgress, {
        phase: "saving",
        total: rows.length,
        processed: start + chunk.length,
        inserted: newTransactionsCount,
        categorized: categorizedCount,
        uncategorized: uncategorizedCount,
      });
    }

    await flushRuleHits(ruleResolver.appliedRuleIds());
```

The rest (`syncTimestamps` update, `return`, 401 `catch`) stays identical.

- [ ] **Step 4: Check that all the tests in the file pass (old and new)**

Run: `pnpm test lib/gocardless/sync.test.ts`
Expected: PASS. The existing tests on hitCount, idempotency, descriptions and 401 must stay green without changes.

- [ ] **Step 5: Commit**

```bash
git add lib/gocardless/sync.ts lib/gocardless/sync.test.ts
git commit -m "perf: insert a blocchi e callback di avanzamento in syncAccountLink"
```

---

### Task 4: Minor optimisations (in-memory token cache, `flushRuleHits` in parallel)

**Files:**
- Modify: `lib/gocardless/client.ts:35-53` (`getAccessToken`)
- Modify: `lib/categorization/resolve.ts` (`flushRuleHits`)
- Test: `lib/gocardless/client.test.ts`

**Interfaces:**
- Produces: `resetAccessTokenCacheForTests(): void` (exported from `client.ts`, only for tests).

- [ ] **Step 1: Add the test (it fails)**

In `lib/gocardless/client.test.ts`: import `resetAccessTokenCacheForTests` together with `getAccessToken`, call it in the existing `beforeEach` (before `vi.stubGlobal`) and add:

```ts
  it("dopo il primo recupero riusa il token dalla memoria, senza rileggere il DB", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ access: "token-mem", access_expires: 3600 }), { status: 200 })
    );
    expect(await getAccessToken()).toBe("token-mem");

    // If the second retrieval read the DB, it would find the cache emptied and would call fetch again.
    await db.delete(gocardlessToken);
    expect(await getAccessToken()).toBe("token-mem");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
```

Run: `pnpm test lib/gocardless/client.test.ts`
Expected: FAIL, `resetAccessTokenCacheForTests` not exported.

- [ ] **Step 2: Implement the cache**

In `lib/gocardless/client.ts`, above `getAccessToken`:

```ts
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/** Module cache: lives as long as the function instance; the DB row stays the cache shared across instances. */
let memoryToken: { accessToken: string; expiresAt: number } | null = null;

/** Clears the in-memory token cache (only for tests). */
export function resetAccessTokenCacheForTests(): void {
  memoryToken = null;
}
```

And replace `getAccessToken`:

```ts
/** Returns a valid access token: memory, then DB cache, otherwise generates a new one. */
export async function getAccessToken(): Promise<string> {
  if (memoryToken && memoryToken.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
    return memoryToken.accessToken;
  }

  const [cached] = await db.select().from(gocardlessToken).where(eq(gocardlessToken.id, TOKEN_ROW_ID));
  if (cached && cached.expiresAt.getTime() > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
    memoryToken = { accessToken: cached.accessToken, expiresAt: cached.expiresAt.getTime() };
    return cached.accessToken;
  }

  const token = await fetchNewToken();
  const expiresAt = new Date(Date.now() + token.access_expires * 1000);
  await db
    .insert(gocardlessToken)
    .values({ id: TOKEN_ROW_ID, accessToken: token.access, expiresAt })
    .onConflictDoUpdate({
      target: gocardlessToken.id,
      set: { accessToken: token.access, expiresAt },
    });

  memoryToken = { accessToken: token.access, expiresAt: expiresAt.getTime() };
  return token.access;
}
```

- [ ] **Step 3: `flushRuleHits` in parallel**

In `lib/categorization/resolve.ts` replace the loop `for (const [id, count] of countById) { await db.update(...) }` with:

```ts
  await Promise.all(
    [...countById].map(([id, count]) =>
      db
        .update(categorizationRules)
        .set({ hitCount: sql`${categorizationRules.hitCount} + ${count}`, lastAppliedAt: now })
        .where(eq(categorizationRules.id, id))
    )
  );
```

- [ ] **Step 4: Check**

Run: `pnpm test lib/gocardless/client.test.ts lib/categorization/resolve.test.ts lib/gocardless/sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gocardless/client.ts lib/gocardless/client.test.ts lib/categorization/resolve.ts
git commit -m "perf: token GoCardless in memoria e flush degli hit delle regole in parallelo"
```

---

### Task 5: `runSyncJob` orchestrator + lock in the scheduler

**Files:**
- Create: `lib/sync-jobs/run.ts`
- Test: `lib/sync-jobs/run.test.ts`
- Modify: `lib/gocardless/scheduler.ts` (`runDueSyncs`)
- Modify: `lib/gocardless/scheduler.test.ts` (only the store mock)

**Interfaces:**
- Consumes: `SyncJobStore` (Task 2), `SyncJobAccountPatch` (Task 1), `syncAccountLink`, `SyncProgress`, `SyncResult`, `SyncableLink` (Task 3), `RateLimitStore`.
- Produces:
  - `progressToPatch(progress: SyncProgress): SyncJobAccountPatch`
  - `resultToPatch(result: SyncResult): SyncJobAccountPatch`
  - `runSyncJob(job: { id: string; userId: string }, links: SyncableLink[], deps: { store: SyncJobStore; rateLimitStore: RateLimitStore }): Promise<void>` (never throws; always releases the lock of every link received)

- [ ] **Step 1: Write the tests (they fail)**

`lib/sync-jobs/run.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gocardless/sync", () => ({ syncAccountLink: vi.fn() }));

import { syncAccountLink, type SyncableLink } from "@/lib/gocardless/sync";
import type { RateLimitStore } from "@/lib/gocardless/rate-limit";
import { queuedAccount } from "./types";
import { createMemorySyncJobKv, createSyncJobStore, type SyncJobStore } from "./store";
import { progressToPatch, resultToPatch, runSyncJob } from "./run";

const rateLimitStore: RateLimitStore = { get: async () => null, set: async () => {} };

function link(accountId: string): SyncableLink {
  return { linkId: `l-${accountId}`, connectionId: "c", accountId, externalAccountId: `ext-${accountId}`, userId: "u1" };
}

describe("progressToPatch / resultToPatch", () => {
  it("mappa avanzamento ed esiti sulle fasi del job", () => {
    expect(progressToPatch({ phase: "saving", total: 10, processed: 5 })).toEqual({ phase: "saving", total: 10, processed: 5 });
    expect(
      resultToPatch({ status: "synced", newTransactionsCount: 4, categorizedCount: 3, uncategorizedCount: 1, balanceUpdated: true })
    ).toEqual({ phase: "done", inserted: 4, categorized: 3, uncategorized: 1 });
    expect(resultToPatch({ status: "gocardless-limited" })).toEqual({ phase: "limited" });
    expect(resultToPatch({ status: "expired" })).toEqual({ phase: "expired" });
  });
});

describe("runSyncJob", () => {
  let store: SyncJobStore;

  beforeEach(() => {
    store = createSyncJobStore(createMemorySyncJobKv());
    vi.mocked(syncAccountLink).mockReset();
  });

  it("sincronizza i conti in parallelo, isola gli errori e rilascia sempre i lock", async () => {
    const job = await store.createJob({
      userId: "u1",
      kind: "initial-import",
      accounts: [queuedAccount("a", "A"), queuedAccount("b", "B")],
    });
    await store.acquireAccountLock("a");
    await store.acquireAccountLock("b");

    let markBStarted: () => void = () => {};
    const bStarted = new Promise<void>((resolve) => (markBStarted = resolve));
    vi.mocked(syncAccountLink).mockImplementation(async (l, _store, onProgress) => {
      if (l.accountId === "a") {
        // "a" finishes only after "b" has started: with sequential execution this test would time out.
        await bStarted;
        await onProgress?.({ phase: "saving", total: 2, processed: 2, inserted: 2, categorized: 2, uncategorized: 0 });
        return { status: "synced", newTransactionsCount: 2, categorizedCount: 2, uncategorizedCount: 0, balanceUpdated: true };
      }
      markBStarted();
      throw new Error("GoCardless 500");
    });

    await runSyncJob(job, [link("a"), link("b")], { store, rateLimitStore });

    const [stored] = await store.listJobs("u1");
    expect(stored.accounts.map((a) => [a.accountId, a.phase])).toEqual([
      ["a", "done"],
      ["b", "error"],
    ]);
    expect(stored.accounts[0]).toMatchObject({ total: 2, processed: 2, inserted: 2 });
    expect(stored.status).toBe("done");
    expect(await store.acquireAccountLock("a")).toBe(true);
    expect(await store.acquireAccountLock("b")).toBe(true);
  });

  it("non lancia se lo store fallisce durante l'aggiornamento", async () => {
    const job = await store.createJob({ userId: "u1", kind: "manual-sync", accounts: [queuedAccount("a", "A")] });
    vi.spyOn(store, "updateAccount").mockRejectedValue(new Error("Redis giù"));
    vi.mocked(syncAccountLink).mockResolvedValue({ status: "expired" });

    await expect(runSyncJob(job, [link("a")], { store, rateLimitStore })).resolves.toBeUndefined();
  });
});
```

Run: `pnpm test lib/sync-jobs/run.test.ts`
Expected: FAIL, `Failed to resolve import "./run"`.

- [ ] **Step 2: Implement `run.ts`**

`lib/sync-jobs/run.ts`:

```ts
import { syncAccountLink, type SyncProgress, type SyncResult, type SyncableLink } from "@/lib/gocardless/sync";
import type { RateLimitStore } from "@/lib/gocardless/rate-limit";
import type { SyncJobStore } from "./store";
import type { SyncJobAccountPatch } from "./types";

export interface RunSyncJobDeps {
  store: SyncJobStore;
  rateLimitStore: RateLimitStore;
}

/** Translates the progress of `syncAccountLink` into a patch of the account in the job. */
export function progressToPatch(progress: SyncProgress): SyncJobAccountPatch {
  return { ...progress };
}

/** Translates the final outcome of a sync into the account's closing phase. */
export function resultToPatch(result: SyncResult): SyncJobAccountPatch {
  switch (result.status) {
    case "synced":
      return {
        phase: "done",
        inserted: result.newTransactionsCount,
        categorized: result.categorizedCount,
        uncategorized: result.uncategorizedCount,
      };
    case "gocardless-limited":
      return { phase: "limited" };
    case "expired":
      return { phase: "expired" };
  }
}

async function runAccount(job: { id: string; userId: string }, link: SyncableLink, deps: RunSyncJobDeps) {
  const update = async (patch: SyncJobAccountPatch) => {
    try {
      await deps.store.updateAccount(job.userId, job.id, link.accountId, patch);
    } catch (error) {
      console.error(`Aggiornamento del job ${job.id} fallito per il conto ${link.accountId}`, error);
    }
  };

  try {
    const result = await syncAccountLink(link, deps.rateLimitStore, (progress) => update(progressToPatch(progress)));
    await update(resultToPatch(result));
  } catch (error) {
    console.error(`Sync fallito per il conto ${link.accountId}`, error);
    await update({ phase: "error" });
  } finally {
    try {
      await deps.store.releaseAccountLock(link.accountId);
    } catch (error) {
      console.error(`Rilascio del lock fallito per il conto ${link.accountId}`, error);
    }
  }
}

/**
 * Runs a sync job: all accounts in parallel, each one isolated from the others' errors.
 * Meant to run in `after()`: it never throws and always releases the lock of the accounts received.
 */
export async function runSyncJob(
  job: { id: string; userId: string },
  links: SyncableLink[],
  deps: RunSyncJobDeps
): Promise<void> {
  await Promise.allSettled(links.map((link) => runAccount(job, link, deps)));
}
```

- [ ] **Step 3: Lock in the scheduler**

In `lib/gocardless/scheduler.ts` add the import:

```ts
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
```

and replace the body of the `runDueSyncs` loop:

```ts
  for (const link of due) {
    const timestamps = link.syncTimestamps.map((t) => new Date(t));
    if (!computeSyncEligibility(timestamps, now).eligible) continue;
    // A manual sync or an import in progress on the same account takes precedence: skip to the next tick.
    // With Redis unreachable proceed anyway (idempotent import): the cron must not stop because of the lock.
    const locked = await redisSyncJobStore.acquireAccountLock(link.accountId).catch(() => true);
    if (!locked) continue;
    try {
      await syncAccountLink(link, redisRateLimitStore);
    } catch (error) {
      console.error(`Sync fallito per il conto ${link.accountId}`, error);
    } finally {
      await redisSyncJobStore.releaseAccountLock(link.accountId).catch(() => {});
    }
  }
```

Update the JSDoc of `runDueSyncs` by adding at the end: `Also skips accounts with a sync already in progress (per-account lock).`

In `lib/gocardless/scheduler.test.ts`, right after the existing `vi.mock("@/lib/gocardless/sync", ...)`, add:

```ts
vi.mock("@/lib/sync-jobs/redis-store", async () => {
  const { createMemorySyncJobKv, createSyncJobStore } = await import("@/lib/sync-jobs/store");
  return { redisSyncJobStore: createSyncJobStore(createMemorySyncJobKv()) };
});
```

- [ ] **Step 4: Check**

Run: `pnpm test lib/sync-jobs/run.test.ts` → Expected: PASS.
Run: `pnpm test lib/gocardless/scheduler.test.ts` → Expected: the same 3 pre-existing failures as before, no more.

- [ ] **Step 5: Commit**

```bash
git add lib/sync-jobs/run.ts lib/sync-jobs/run.test.ts lib/gocardless/scheduler.ts lib/gocardless/scheduler.test.ts
git commit -m "feat: orchestratore runSyncJob e lock per conto nello scheduler"
```

---

### Task 6: Manual sync route as a job

**Files:**
- Modify: `app/api/gocardless/accounts/[accountId]/sync/route.ts`
- Modify: `app/api/gocardless/accounts/[accountId]/sync/route.test.ts`

**Interfaces:**
- Consumes: `redisSyncJobStore` (Task 2), `runSyncJob` (Task 5), `queuedAccount` (Task 1).
- Produces (HTTP contract for Task 9): `POST` → `202 { jobId: string }` | `404` | `429 { status: "not-eligible", nextEligibleAt, syncsRemainingToday }` | `409 { status: "already-running" }` | `503 { status: "unavailable" }`.

- [ ] **Step 1: Rewrite the tests**

In `route.test.ts`:

1. Replace `import { NextRequest } from "next/server";` with the mocks of `next/server` and of the store, before the other `vi.mock`:

```ts
import { NextRequest, after } from "next/server";
```

```ts
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/sync-jobs/redis-store", async () => {
  const { createMemorySyncJobKv, createSyncJobStore } = await import("@/lib/sync-jobs/store");
  return { redisSyncJobStore: createSyncJobStore(createMemorySyncJobKv()) };
});
```

2. Add the import `import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";`, a module variable `const afterTasks: Promise<unknown>[] = [];` and in the `beforeEach`:

```ts
    afterTasks.length = 0;
    vi.mocked(after).mockClear();
    vi.mocked(after).mockImplementation((task) => {
      afterTasks.push(Promise.resolve(typeof task === "function" ? task() : task));
    });
```

3. Replace the tests `"sincronizza e restituisce il riepilogo quando eleggibile"` and `"mappa 'gocardless-limited' a 429 ed 'expired' a 409"` with:

```ts
  function postSync() {
    return POST(new NextRequest(`http://localhost/api/gocardless/accounts/${accountId}/sync`, { method: "POST" }), {
      params: Promise.resolve({ accountId }),
    });
  }

  it("risponde 202 con jobId e completa il job in background", async () => {
    await createLinkedAccount();
    vi.mocked(syncAccountLink).mockResolvedValue({
      status: "synced",
      newTransactionsCount: 3,
      categorizedCount: 2,
      uncategorizedCount: 1,
      balanceUpdated: true,
    });

    const response = await postSync();
    expect(response.status).toBe(202);
    const { jobId } = await response.json();
    await Promise.all(afterTasks);

    const job = (await redisSyncJobStore.listJobs(userId)).find((j) => j.id === jobId);
    expect(job?.kind).toBe("manual-sync");
    expect(job?.accounts[0]).toMatchObject({ accountId, name: "Conto Auto", phase: "done", inserted: 3 });
    expect(await redisSyncJobStore.acquireAccountLock(accountId)).toBe(true);
  });

  it("risponde 409 senza avviare nulla se il conto ha già un sync in corso", async () => {
    await createLinkedAccount();
    await redisSyncJobStore.acquireAccountLock(accountId);

    const response = await postSync();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ status: "already-running" });
    expect(after).not.toHaveBeenCalled();
    expect(syncAccountLink).not.toHaveBeenCalled();
  });

  it("risponde 503 e rilascia il lock se lo store dei job non risponde", async () => {
    await createLinkedAccount();
    vi.spyOn(redisSyncJobStore, "createJob").mockRejectedValueOnce(new Error("Redis giù"));

    const response = await postSync();
    expect(response.status).toBe(503);
    expect(await redisSyncJobStore.acquireAccountLock(accountId)).toBe(true);
  });
```

4. In the existing test `"risponde 429 senza chiamare syncAccountLink se il budget condiviso è esaurito"` add at the end `expect(after).not.toHaveBeenCalled();`.

Run: `pnpm test "app/api/gocardless/accounts/[accountId]/sync/route.test.ts"`
Expected: FAIL (the route still responds 200 synchronously).

- [ ] **Step 2: Rewrite the route**

`app/api/gocardless/accounts/[accountId]/sync/route.ts`:

```ts
import { NextRequest, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "@/lib/gocardless/redis-rate-limit-store";
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { runSyncJob } from "@/lib/sync-jobs/run";
import { queuedAccount, type SyncJob } from "@/lib/sync-jobs/types";

// The sync runs in after(): on Vercel the function stays alive at most for this time (seconds).
export const maxDuration = 300;

/**
 * Starts a manual sync of a linked account as a background job.
 * Ownership, eligibility (shared budget 4/day + 4h gap) and per-account lock stay synchronous,
 * so predictable errors arrive as an HTTP response: 404, 429 not-eligible, 409 already-running,
 * 503 if the job store does not respond. Otherwise it creates the job and responds immediately 202 { jobId }.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const { accountId } = await params;

  const [link] = await db
    .select({
      linkId: bankAccountLinks.id,
      connectionId: bankAccountLinks.connectionId,
      accountId: bankAccountLinks.accountId,
      externalAccountId: bankAccountLinks.externalAccountId,
      syncTimestamps: bankAccountLinks.syncTimestamps,
      userId: bankConnections.userId,
      accountName: accounts.name,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .innerJoin(accounts, eq(bankAccountLinks.accountId, accounts.id))
    .where(
      and(
        eq(bankAccountLinks.accountId, accountId),
        eq(bankConnections.userId, session.user.id),
        eq(bankConnections.status, "linked")
      )
    );

  if (!link) return Response.json({ error: "Conto non trovato o non collegato" }, { status: 404 });

  const eligibility = computeSyncEligibility(
    link.syncTimestamps.map((t) => new Date(t)),
    new Date()
  );
  if (!eligibility.eligible) {
    return Response.json(
      {
        status: "not-eligible",
        nextEligibleAt: eligibility.nextEligibleAt,
        syncsRemainingToday: eligibility.syncsRemainingToday,
      },
      { status: 429 }
    );
  }

  const store = redisSyncJobStore;
  let locked: boolean;
  try {
    locked = await store.acquireAccountLock(link.accountId);
  } catch (error) {
    console.error("Store dei job di sync non raggiungibile", error);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
  if (!locked) return Response.json({ status: "already-running" }, { status: 409 });

  let job: SyncJob;
  try {
    job = await store.createJob({
      userId: session.user.id,
      kind: "manual-sync",
      accounts: [queuedAccount(link.accountId, link.accountName)],
    });
  } catch (error) {
    console.error("Creazione del job di sync fallita", error);
    await store.releaseAccountLock(link.accountId).catch(() => {});
    return Response.json({ status: "unavailable" }, { status: 503 });
  }

  const syncableLink = {
    linkId: link.linkId,
    connectionId: link.connectionId,
    accountId: link.accountId,
    externalAccountId: link.externalAccountId,
    userId: link.userId,
  };
  after(() => runSyncJob(job, [syncableLink], { store, rateLimitStore: redisRateLimitStore }));

  return Response.json({ jobId: job.id }, { status: 202 });
}
```

- [ ] **Step 3: Check**

Run: `pnpm test "app/api/gocardless/accounts/[accountId]/sync/route.test.ts"`
Expected: PASS (404, 429, 202, 409, 503).

- [ ] **Step 4: Commit**

```bash
git add "app/api/gocardless/accounts/[accountId]/sync/route.ts" "app/api/gocardless/accounts/[accountId]/sync/route.test.ts"
git commit -m "feat: sync manuale come job in background con lock per conto"
```

---

### Task 7: Finalize route (Conti trovati) as a job

**Files:**
- Modify: `app/api/gocardless/connections/[id]/finalize/route.ts`
- Modify: `app/api/gocardless/connections/[id]/finalize/route.test.ts`

**Interfaces:**
- Consumes: `redisSyncJobStore`, `runSyncJob`, `queuedAccount`, `SyncJobAccount`.
- Produces (HTTP contract for Task 9): `POST` → `201 { jobId: string }` | `400` | `404` | `503 { error: string }`.

- [ ] **Step 1: Update the tests**

In `route.test.ts` apply the same setup as Task 6 (import `after` from `next/server`, the two `vi.mock` of `next/server` and `@/lib/sync-jobs/redis-store`, `afterTasks` and the `mockImplementation` of `after` in the `beforeEach`, import of `redisSyncJobStore`). Change the `syncAccountLink` mock so that it returns a valid outcome:

```ts
vi.mock("@/lib/gocardless/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/sync")>();
  return {
    ...actual,
    syncAccountLink: vi.fn().mockResolvedValue({
      status: "synced",
      newTransactionsCount: 0,
      categorizedCount: 0,
      uncategorizedCount: 0,
      balanceUpdated: true,
    }),
  };
});
```

In the test `"crea un nuovo conto per una selezione 'new' e lancia il sync"`, after `expect(response.status).toBe(201);` replace `expect(syncAccountLink).toHaveBeenCalledTimes(1);` with:

```ts
    const { jobId } = await response.json();
    await Promise.all(afterTasks);
    expect(syncAccountLink).toHaveBeenCalledTimes(1);
    const job = (await redisSyncJobStore.listJobs(userId)).find((j) => j.id === jobId);
    expect(job?.kind).toBe("initial-import");
    expect(job?.accounts).toHaveLength(1);
    expect(job?.accounts[0]).toMatchObject({ name: "Conto Corrente", phase: "done" });
```

In the test `"risponde comunque 201 se il sync iniziale fallisce (l'account resta creato)"` add after the assert on the status:

```ts
    const { jobId } = await response.json();
    await Promise.all(afterTasks);
    const job = (await redisSyncJobStore.listJobs(userId)).find((j) => j.id === jobId);
    expect(job?.accounts[0].phase).toBe("error");
```

In the test `"risponde 404 se existingAccountId appartiene a un altro utente"` add at the end:

```ts
    expect(await redisSyncJobStore.listJobs(userId)).toEqual([]);
```

Add the new tests:

```ts
  function postFinalize(selections: unknown[]) {
    return POST(
      new NextRequest(`http://localhost/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        body: JSON.stringify({ selections }),
      }),
      { params: Promise.resolve({ id: connectionId }) }
    );
  }

  it("sincronizza più conti nello stesso job", async () => {
    const response = await postFinalize([
      { externalAccountId: "ext-1", name: "Conto A", type: "Conto corrente", mode: "new" },
      { externalAccountId: "ext-2", name: "Conto B", type: "Conto corrente", mode: "new" },
    ]);
    const { jobId } = await response.json();
    await Promise.all(afterTasks);

    expect(syncAccountLink).toHaveBeenCalledTimes(2);
    const job = (await redisSyncJobStore.listJobs(userId)).find((j) => j.id === jobId);
    expect(job?.accounts.map((a) => a.name)).toEqual(["Conto A", "Conto B"]);
    expect(job?.status).toBe("done");
  });

  it("risponde 503 senza creare conti se lo store dei job non risponde", async () => {
    vi.spyOn(redisSyncJobStore, "createJob").mockRejectedValueOnce(new Error("Redis giù"));
    const response = await postFinalize([
      { externalAccountId: "ext-1", name: "Conto A", type: "Conto corrente", mode: "new" },
    ]);
    expect(response.status).toBe(503);
    expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toEqual([]);
  });
```

Run: `pnpm test "app/api/gocardless/connections/[id]/finalize/route.test.ts"`
Expected: FAIL (no `jobId`, no 503).

- [ ] **Step 2: Rewrite the route**

`app/api/gocardless/connections/[id]/finalize/route.ts`. Compared to today, the validation of the `existing` selections happens **before** the creation of the job, so a 400/404 leaves neither orphan jobs nor half-updated accounts:

```ts
import { NextRequest, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "@/lib/gocardless/redis-rate-limit-store";
import type { SyncableLink } from "@/lib/gocardless/sync";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { runSyncJob } from "@/lib/sync-jobs/run";
import { queuedAccount, type SyncJob, type SyncJobAccount } from "@/lib/sync-jobs/types";
import { finalizeSelectionSchema } from "@/lib/validation/gocardless";

// The initial import runs in after(): on Vercel the function stays alive at most for this time (seconds).
export const maxDuration = 300;

const STORE_UNAVAILABLE_MESSAGE = "Servizio temporaneamente non disponibile. Riprova tra poco.";

/**
 * Finalises the selection of the "Conti trovati": creates or relinks the accounts and starts the initial import
 * as a background job (all accounts in parallel). Responds immediately 201 { jobId }.
 * Validation and ownership happen before creating the job; if the job store does not respond,
 * 503 before creating any account.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;
  const [connection] = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.id, id), eq(bankConnections.userId, userId)));
  if (!connection) return new Response(null, { status: 404 });

  const body = await request.json();
  const parsed = finalizeSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // First pass: checks only, no writes.
  const existingNames = new Map<string, string>();
  for (const selection of parsed.data.selections) {
    if (selection.mode !== "existing") continue;
    if (!selection.existingAccountId) {
      return Response.json({ error: "existingAccountId richiesto per mode 'existing'" }, { status: 400 });
    }
    // The selected account must belong to the session user, otherwise a user
    // could relink (and thus hijack the sync of) another user's "auto" account.
    const [ownedAccount] = await db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(
        and(eq(accounts.id, selection.existingAccountId), eq(accounts.userId, userId), eq(accounts.source, "auto"))
      );
    if (!ownedAccount) {
      return Response.json({ error: "Conto non trovato" }, { status: 404 });
    }
    existingNames.set(ownedAccount.id, ownedAccount.name);
  }

  const store = redisSyncJobStore;
  let job: SyncJob;
  try {
    job = await store.createJob({ userId, kind: "initial-import" });
  } catch (error) {
    console.error("Creazione del job di import fallita", error);
    return Response.json({ error: STORE_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  // Second pass: writes.
  const created: { link: SyncableLink; name: string }[] = [];
  for (const selection of parsed.data.selections) {
    if (selection.mode === "existing" && selection.existingAccountId) {
      const [updatedLink] = await db
        .update(bankAccountLinks)
        .set({ connectionId: connection.id, externalAccountId: selection.externalAccountId })
        .where(eq(bankAccountLinks.accountId, selection.existingAccountId))
        .returning();
      if (!updatedLink) {
        return Response.json({ error: "Conto non trovato" }, { status: 404 });
      }
      created.push({
        name: existingNames.get(selection.existingAccountId) ?? selection.name,
        link: {
          linkId: updatedLink.id,
          connectionId: connection.id,
          accountId: selection.existingAccountId,
          externalAccountId: selection.externalAccountId,
          userId,
        },
      });
    } else {
      const [account] = await db
        .insert(accounts)
        .values({ userId, name: selection.name, type: selection.type, source: "auto" })
        .returning();
      const [link] = await db
        .insert(bankAccountLinks)
        .values({ connectionId: connection.id, accountId: account.id, externalAccountId: selection.externalAccountId })
        .returning();
      created.push({
        name: account.name,
        link: {
          linkId: link.id,
          connectionId: connection.id,
          accountId: account.id,
          externalAccountId: selection.externalAccountId,
          userId,
        },
      });
    }
  }

  // An "existing" account may already have a sync in progress: don't duplicate it, flag it in the job.
  const linksToSync: SyncableLink[] = [];
  const jobAccounts: SyncJobAccount[] = [];
  for (const { link, name } of created) {
    // If the lock cannot be read proceed anyway: the import is idempotent.
    const locked = await store.acquireAccountLock(link.accountId).catch(() => true);
    if (locked) {
      linksToSync.push(link);
      jobAccounts.push(queuedAccount(link.accountId, name));
    } else {
      jobAccounts.push({ ...queuedAccount(link.accountId, name), phase: "error", errorReason: "already-running" });
    }
  }

  try {
    await store.setAccounts(userId, job.id, jobAccounts);
  } catch (error) {
    // The data stays correct: the sync starts anyway, the job will be shown as interrupted.
    console.error(`Registrazione dei conti nel job ${job.id} fallita`, error);
  }

  // Best-effort: the accounts/links are already created. A failure of the initial sync ends up in the job
  // as an account error, it does not fail the request (a retry would duplicate the "new" accounts).
  after(() => runSyncJob(job, linksToSync, { store, rateLimitStore: redisRateLimitStore }));

  return Response.json({ jobId: job.id }, { status: 201 });
}
```

- [ ] **Step 3: Check**

Run: `pnpm test "app/api/gocardless/connections/[id]/finalize/route.test.ts"`
Expected: PASS (all of them, including the existing 400/404).

- [ ] **Step 4: Commit**

```bash
git add "app/api/gocardless/connections/[id]/finalize/route.ts" "app/api/gocardless/connections/[id]/finalize/route.test.ts"
git commit -m "feat: import dei conti trovati come job in background, conti in parallelo"
```

---

### Task 8: API for reading and closing jobs

**Files:**
- Create: `app/api/sync-jobs/route.ts`
- Create: `app/api/sync-jobs/[id]/dismiss/route.ts`
- Test: `app/api/sync-jobs/route.test.ts`

**Interfaces:**
- Consumes: `redisSyncJobStore`, `toJobView`.
- Produces (HTTP contract for Task 9): `GET /api/sync-jobs` → `200 SyncJobView[]` (only non-`dismissed`, sorted from the most recent) | `401` | `503`; `POST /api/sync-jobs/[id]/dismiss` → `204` | `401` | `404` | `503`.

- [ ] **Step 1: Write the tests**

`app/api/sync-jobs/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/sync-jobs/redis-store", async () => {
  const { createMemorySyncJobKv, createSyncJobStore } = await import("@/lib/sync-jobs/store");
  return { redisSyncJobStore: createSyncJobStore(createMemorySyncJobKv()) };
});

import { auth } from "@/lib/auth";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { queuedAccount } from "@/lib/sync-jobs/types";
import { GET } from "./route";
import { POST as DISMISS } from "./[id]/dismiss/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function dismiss(id: string) {
  return DISMISS(new NextRequest(`http://localhost/api/sync-jobs/${id}/dismiss`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("API sync-jobs", () => {
  let userId: string;

  beforeEach(() => {
    userId = `user-${crypto.randomUUID()}`;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  it("GET risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(new NextRequest("http://localhost/api/sync-jobs"));
    expect(response.status).toBe(401);
  });

  it("GET restituisce solo i job non chiusi dell'utente, come vista", async () => {
    const mine = await redisSyncJobStore.createJob({ userId, kind: "manual-sync", accounts: [queuedAccount("a", "A")] });
    const closed = await redisSyncJobStore.createJob({ userId, kind: "manual-sync", accounts: [] });
    await redisSyncJobStore.dismissJob(userId, closed.id);
    await redisSyncJobStore.createJob({ userId: "altro-utente", kind: "manual-sync", accounts: [] });

    const response = await GET(new NextRequest("http://localhost/api/sync-jobs"));
    const body = await response.json();
    expect(body.map((job: { id: string }) => job.id)).toEqual([mine.id]);
    expect(body[0].interrupted).toBe(false);
  });

  it("dismiss chiude un proprio job e rifiuta con 404 quello di un altro utente", async () => {
    const foreign = await redisSyncJobStore.createJob({ userId: "altro-utente", kind: "manual-sync", accounts: [] });
    expect((await dismiss(foreign.id)).status).toBe(404);

    const mine = await redisSyncJobStore.createJob({ userId, kind: "manual-sync", accounts: [] });
    expect((await dismiss(mine.id)).status).toBe(204);
    expect((await redisSyncJobStore.listJobs(userId))[0].dismissed).toBe(true);
  });

  it("GET risponde 503 se lo store non risponde", async () => {
    vi.spyOn(redisSyncJobStore, "listJobs").mockRejectedValueOnce(new Error("Redis giù"));
    const response = await GET(new NextRequest("http://localhost/api/sync-jobs"));
    expect(response.status).toBe(503);
  });
});
```

Run: `pnpm test app/api/sync-jobs/route.test.ts`
Expected: FAIL, routes do not exist.

- [ ] **Step 2: Implement the routes**

`app/api/sync-jobs/route.ts`:

```ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { toJobView } from "@/lib/sync-jobs/view";

/** Sync jobs of the session user not yet closed, ready for the UI (heartbeat evaluated). */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  try {
    const jobs = await redisSyncJobStore.listJobs(session.user.id);
    const now = new Date();
    return Response.json(jobs.filter((job) => !job.dismissed).map((job) => toJobView(job, now)));
  } catch (error) {
    console.error("Lettura dei job di sync fallita", error);
    return Response.json({ error: "Stato della sincronizzazione non disponibile" }, { status: 503 });
  }
}
```

`app/api/sync-jobs/[id]/dismiss/route.ts`:

```ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";

/** Closes a job's summary: it stays hidden on other devices too. Only jobs of the session user. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const { id } = await params;
  try {
    const dismissed = await redisSyncJobStore.dismissJob(session.user.id, id);
    return dismissed ? new Response(null, { status: 204 }) : new Response(null, { status: 404 });
  } catch (error) {
    console.error("Chiusura del job di sync fallita", error);
    return new Response(null, { status: 503 });
  }
}
```

- [ ] **Step 3: Check**

Run: `pnpm test app/api/sync-jobs/route.test.ts` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/sync-jobs
git commit -m "feat: API di lettura e chiusura dei job di sync"
```

---

### Task 9: Client hooks and mutations adapted to jobs

**Files:**
- Create: `lib/queries/sync-jobs.ts`
- Modify: `lib/queries/gocardless.ts` (`useFinalizeConnectionMutation`, `useSyncAccountMutation`)
- Modify: `lib/gocardless/sync-messages.ts` (`SyncErrorInfo`, `buildSyncErrorMessage`)
- Test: `lib/gocardless/sync-messages.test.ts`

**Interfaces:**
- Consumes: HTTP contracts of Tasks 6-8; `SyncJobView` (Task 1); `runningJobIds`, `hasFinishedSince` (Task 1).
- Produces:
  - `SYNC_JOBS_QUERY_KEY = ["sync-jobs"] as const`, `SYNC_JOBS_POLL_INTERVAL_MS = 1000`
  - `useSyncJobsQuery(): UseQueryResult<SyncJobView[]>`
  - `useInvalidateOnSyncJobFinish(jobs: SyncJobView[] | undefined): void`
  - `useDismissSyncJobMutation(): UseMutationResult<void, Error, string>`
  - `useSyncAccountMutation()` now resolves with `{ jobId: string }`
  - `SyncErrorInfo` includes `{ status: "already-running" }` and `{ status: "unavailable" }`

- [ ] **Step 1: Tests for the new error messages (they fail)**

In `lib/gocardless/sync-messages.test.ts` add, inside the `describe` of `buildSyncErrorMessage` (or in a new `describe` with the same name if it doesn't exist):

```ts
  it("spiega un sync già in corso e un servizio non disponibile", () => {
    expect(buildSyncErrorMessage({ status: "already-running" })).toBe(
      "Sincronizzazione già in corso per questo conto."
    );
    expect(buildSyncErrorMessage({ status: "unavailable" })).toBe(
      "Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco."
    );
  });
```

Run: `pnpm test lib/gocardless/sync-messages.test.ts` → Expected: FAIL (type/default value error).

- [ ] **Step 2: Extend `sync-messages.ts`**

Add the two variants to `SyncErrorInfo`:

```ts
export type SyncErrorInfo =
  | { status: "not-eligible"; nextEligibleAt: string | null; syncsRemainingToday: number }
  | { status: "gocardless-limited" }
  | { status: "expired" }
  | { status: "already-running" }
  | { status: "unavailable" }
  | { status: "unknown" };
```

And in `buildSyncErrorMessage`, before the `default`:

```ts
    case "already-running":
      return "Sincronizzazione già in corso per questo conto.";
    case "unavailable":
      return "Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco.";
```

Run: `pnpm test lib/gocardless/sync-messages.test.ts` → Expected: PASS.

- [ ] **Step 3: Create `lib/queries/sync-jobs.ts`**

```ts
"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SyncJobView } from "@/lib/sync-jobs/types";
import { hasFinishedSince, runningJobIds } from "@/lib/sync-jobs/view";

export const SYNC_JOBS_QUERY_KEY = ["sync-jobs"] as const;
export const SYNC_JOBS_POLL_INTERVAL_MS = 1000;

/** Queries invalidated at the end of a job: the data a sync may have changed. */
const QUERY_KEYS_CHANGED_BY_SYNC = [
  ["accounts"],
  ["transactions"],
  ["gocardless", "connections", "status"],
  ["net-worth-snapshots"],
] as const;

/** The user's sync jobs; polls the server every second only while at least one job is running. */
export function useSyncJobsQuery() {
  return useQuery({
    queryKey: SYNC_JOBS_QUERY_KEY,
    queryFn: async (): Promise<SyncJobView[]> => {
      const response = await fetch("/api/sync-jobs");
      if (!response.ok) throw new Error("Impossibile leggere lo stato della sincronizzazione");
      return response.json();
    },
    refetchInterval: (query) => (runningJobIds(query.state.data).size > 0 ? SYNC_JOBS_POLL_INTERVAL_MS : false),
  });
}

/** When a job ends, refreshes accounts, transactions and net worth. To be used in a single place (the global panel). */
export function useInvalidateOnSyncJobFinish(jobs: SyncJobView[] | undefined): void {
  const queryClient = useQueryClient();
  const previous = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const current = runningJobIds(jobs);
    if (hasFinishedSince(previous.current, current)) {
      for (const queryKey of QUERY_KEYS_CHANGED_BY_SYNC) {
        queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    }
    previous.current = current;
  }, [jobs, queryClient]);
}

/** Closes the summary of a finished job. */
export function useDismissSyncJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string): Promise<void> => {
      const response = await fetch(`/api/sync-jobs/${jobId}/dismiss`, { method: "POST" });
      if (!response.ok) throw new Error("Impossibile chiudere il riepilogo");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY }),
  });
}
```

- [ ] **Step 4: Adapt `lib/queries/gocardless.ts`**

1. Replace the imports from `sync-messages` with:

```ts
import { buildSyncErrorMessage } from "@/lib/gocardless/sync-messages";
import type { SyncErrorInfo } from "@/lib/gocardless/sync-messages";
import { SYNC_JOBS_QUERY_KEY } from "@/lib/queries/sync-jobs";
```

2. In `useFinalizeConnectionMutation`, type the return of `mutationFn` as `Promise<{ jobId: string }>` and add in `onSuccess`:

```ts
      queryClient.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY });
```

3. Replace `useSyncAccountMutation` and its JSDoc:

```ts
/** Starts a manual sync as a background job; progress appears in the global panel. Immediate errors go to a toast. */
export function useSyncAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string): Promise<{ jobId: string }> => {
      const response = await fetch(`/api/gocardless/accounts/${accountId}/sync`, { method: "POST" });
      const body = await response.json().catch(() => ({ status: "unknown" }));
      if (!response.ok) throw new SyncNotAvailableError(body);
      return body as { jobId: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      const info: SyncErrorInfo = error instanceof SyncNotAvailableError ? error.info : { status: "unknown" };
      toast.error(buildSyncErrorMessage(info));
    },
  });
}
```

`buildSyncSummaryMessage` stays exported from `sync-messages.ts`: the panel reuses it (Task 10).

- [ ] **Step 5: Check**

Run: `pnpm exec tsc --noEmit` → Expected: no errors.
Run: `pnpm test lib/gocardless/sync-messages.test.ts` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/queries/sync-jobs.ts lib/queries/gocardless.ts lib/gocardless/sync-messages.ts lib/gocardless/sync-messages.test.ts
git commit -m "feat: hook client per i job di sync con polling solo durante i job attivi"
```

---

### Task 10: Global progress panel

**Files:**
- Create: `components/domain/sync/describe-account-progress.ts`
- Test: `components/domain/sync/describe-account-progress.test.ts`
- Create: `components/domain/sync/progress-bar.tsx`
- Create: `components/domain/sync/sync-account-progress-row.tsx`
- Create: `components/domain/sync/sync-progress-panel.tsx`
- Create: `components/domain/sync/sync-progress-indicator.tsx`
- Create: `components/domain/sync/index.ts`
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `SyncJobAccount`, `SyncJobView` (Task 1), `overallProgress` (Task 1), `buildSyncSummaryMessage`, `buildSyncErrorMessage` (existing), Task 9 hooks.
- Produces:
  - `type ProgressBarState = { kind: "none" } | { kind: "indeterminate" } | { kind: "determinate"; value: number; max: number }`
  - `interface AccountProgressDescription { text: string; bar: ProgressBarState; tone: "default" | "success" | "error" }`
  - `describeAccountProgress(account: SyncJobAccount, interrupted: boolean): AccountProgressDescription`
  - `describeJobTitle(job: SyncJobView): string`
  - `SyncProgressPanel({ jobs, onDismiss, categorizeHref? })`, `SyncProgressIndicator()`

- [ ] **Step 1: Tests for the per-phase texts (they fail)**

`components/domain/sync/describe-account-progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { queuedAccount, type SyncJobAccount, type SyncJobView } from "@/lib/sync-jobs/types";
import { describeAccountProgress, describeJobTitle } from "./describe-account-progress";

function account(overrides: Partial<SyncJobAccount>): SyncJobAccount {
  return { ...queuedAccount("a", "Conto"), ...overrides };
}

describe("describeAccountProgress", () => {
  it("descrive le fasi in corso con la barra giusta", () => {
    expect(describeAccountProgress(account({ phase: "queued" }), false)).toEqual({
      text: "In attesa",
      bar: { kind: "none" },
      tone: "default",
    });
    expect(describeAccountProgress(account({ phase: "balance" }), false).text).toBe("Aggiorno il saldo…");
    expect(describeAccountProgress(account({ phase: "fetching" }), false)).toEqual({
      text: "Scarico i movimenti dalla banca…",
      bar: { kind: "indeterminate" },
      tone: "default",
    });
    expect(describeAccountProgress(account({ phase: "saving", total: 500, processed: 120 }), false)).toEqual({
      text: "Importati 120 di 500 movimenti",
      bar: { kind: "determinate", value: 120, max: 500 },
      tone: "default",
    });
  });

  it("usa il singolare con un solo movimento", () => {
    expect(describeAccountProgress(account({ phase: "saving", total: 1, processed: 0 }), false).text).toBe(
      "Importati 0 di 1 movimento"
    );
  });

  it("riassume un conto concluso riusando il messaggio di esito esistente", () => {
    expect(
      describeAccountProgress(account({ phase: "done", total: 3, processed: 3, inserted: 3, categorized: 2, uncategorized: 1 }), false)
    ).toEqual({
      text: "3 nuove transazioni (2 categorizzate, 1 da categorizzare). Saldo aggiornato.",
      bar: { kind: "determinate", value: 1, max: 1 },
      tone: "success",
    });
    expect(describeAccountProgress(account({ phase: "done", inserted: 0 }), false).text).toBe(
      "Nessuna nuova transazione trovata. Saldo aggiornato."
    );
  });

  it("spiega errori, limiti, sessione scaduta e interruzione", () => {
    expect(describeAccountProgress(account({ phase: "limited" }), false).text).toBe(
      "La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi."
    );
    expect(describeAccountProgress(account({ phase: "expired" }), false).tone).toBe("error");
    expect(describeAccountProgress(account({ phase: "error", errorReason: "already-running" }), false).text).toBe(
      "Sincronizzazione già in corso per questo conto."
    );
    expect(describeAccountProgress(account({ phase: "error" }), false).text).toBe(
      "Sincronizzazione non riuscita. Riprova più tardi."
    );
    expect(describeAccountProgress(account({ phase: "error" }), true).text).toBe(
      "Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì."
    );
  });
});

describe("describeJobTitle", () => {
  const base: SyncJobView = {
    id: "j",
    userId: "u",
    kind: "initial-import",
    status: "running",
    dismissed: false,
    startedAt: "2026-09-22T10:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
    accounts: [account({}), account({ accountId: "b" })],
    interrupted: false,
  };

  it("titola il job in base allo stato", () => {
    expect(describeJobTitle(base)).toBe("Sincronizzazione in corso · 2 conti");
    expect(describeJobTitle({ ...base, accounts: [account({})] })).toBe("Sincronizzazione in corso · 1 conto");
    expect(describeJobTitle({ ...base, status: "done" })).toBe("Sincronizzazione completata");
    expect(describeJobTitle({ ...base, status: "failed" })).toBe("Sincronizzazione non riuscita");
    expect(describeJobTitle({ ...base, status: "done", interrupted: true })).toBe("Sincronizzazione interrotta");
  });
});
```

Run: `pnpm test components/domain/sync/describe-account-progress.test.ts` → Expected: FAIL, module does not exist.

- [ ] **Step 2: Implement `describe-account-progress.ts`**

```ts
import { buildSyncErrorMessage, buildSyncSummaryMessage } from "@/lib/gocardless/sync-messages";
import type { SyncJobAccount, SyncJobView } from "@/lib/sync-jobs/types";

export type ProgressBarState =
  | { kind: "none" }
  | { kind: "indeterminate" }
  | { kind: "determinate"; value: number; max: number };

export interface AccountProgressDescription {
  text: string;
  bar: ProgressBarState;
  tone: "default" | "success" | "error";
}

const QUEUED_TEXT = "In attesa";
const BALANCE_TEXT = "Aggiorno il saldo…";
const FETCHING_TEXT = "Scarico i movimenti dalla banca…";
const ERROR_TEXT = "Sincronizzazione non riuscita. Riprova più tardi.";
const INTERRUPTED_TEXT = "Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì.";

const NO_BAR: ProgressBarState = { kind: "none" };
const FULL_BAR: ProgressBarState = { kind: "determinate", value: 1, max: 1 };

/** Text, bar and tone of an account in the sync panel, based on the phase. */
export function describeAccountProgress(account: SyncJobAccount, interrupted: boolean): AccountProgressDescription {
  switch (account.phase) {
    case "queued":
      return { text: QUEUED_TEXT, bar: NO_BAR, tone: "default" };
    case "balance":
      return { text: BALANCE_TEXT, bar: { kind: "indeterminate" }, tone: "default" };
    case "fetching":
      return { text: FETCHING_TEXT, bar: { kind: "indeterminate" }, tone: "default" };
    case "saving": {
      const total = account.total ?? 0;
      const noun = total === 1 ? "movimento" : "movimenti";
      return {
        text: `Importati ${account.processed} di ${total} ${noun}`,
        bar: { kind: "determinate", value: account.processed, max: Math.max(total, 1) },
        tone: "default",
      };
    }
    case "done":
      return {
        text: buildSyncSummaryMessage({
          status: "synced",
          newTransactionsCount: account.inserted,
          categorizedCount: account.categorized,
          uncategorizedCount: account.uncategorized,
          balanceUpdated: true,
        }),
        bar: FULL_BAR,
        tone: "success",
      };
    case "limited":
      return { text: buildSyncErrorMessage({ status: "gocardless-limited" }), bar: NO_BAR, tone: "error" };
    case "expired":
      return { text: buildSyncErrorMessage({ status: "expired" }), bar: NO_BAR, tone: "error" };
    case "error":
      if (account.errorReason === "already-running") {
        return { text: buildSyncErrorMessage({ status: "already-running" }), bar: NO_BAR, tone: "error" };
      }
      return { text: interrupted ? INTERRUPTED_TEXT : ERROR_TEXT, bar: NO_BAR, tone: "error" };
  }
}

/** Short title of a job for the panel header. */
export function describeJobTitle(job: SyncJobView): string {
  if (job.interrupted) return "Sincronizzazione interrotta";
  if (job.status === "done") return "Sincronizzazione completata";
  if (job.status === "failed") return "Sincronizzazione non riuscita";
  const count = job.accounts.length;
  return `Sincronizzazione in corso · ${count} ${count === 1 ? "conto" : "conti"}`;
}
```

Run: `pnpm test components/domain/sync/describe-account-progress.test.ts` → Expected: PASS.

- [ ] **Step 3: UI components**

`components/domain/sync/progress-bar.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { ProgressBarState } from "./describe-account-progress";

export interface ProgressBarProps {
  state: ProgressBarState;
  /** Accessible label of the bar (e.g. the account name). */
  label: string;
  className?: string;
}

/** Thin progress bar: determinate (with aria-valuenow) or indeterminate (pulsing, only if motion is allowed). */
export function ProgressBar({ state, label, className }: ProgressBarProps) {
  if (state.kind === "none") return null;

  if (state.kind === "indeterminate") {
    return (
      <div
        role="progressbar"
        aria-label={label}
        aria-busy="true"
        className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      >
        <div className="h-full w-full rounded-full bg-primary/50 motion-safe:animate-pulse" />
      </div>
    );
  }

  const percent = Math.min(100, Math.round((state.value / state.max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={state.max}
      aria-valuenow={state.value}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
```

`components/domain/sync/sync-account-progress-row.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { SyncJobAccount } from "@/lib/sync-jobs/types";
import { describeAccountProgress } from "./describe-account-progress";
import { ProgressBar } from "./progress-bar";

export interface SyncAccountProgressRowProps {
  account: SyncJobAccount;
  interrupted: boolean;
}

/** Panel row for a single account: name, text status and bar. */
export function SyncAccountProgressRow({ account, interrupted }: SyncAccountProgressRowProps) {
  const description = describeAccountProgress(account, interrupted);
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium text-foreground">{account.name}</span>
      </div>
      <p
        className={cn(
          "text-xs",
          description.tone === "error" && "text-destructive",
          description.tone === "success" && "text-pos",
          description.tone === "default" && "text-muted-foreground"
        )}
      >
        {description.text}
      </p>
      <ProgressBar state={description.bar} label={`Avanzamento ${account.name}`} />
    </li>
  );
}
```

`components/domain/sync/sync-progress-panel.tsx`:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SyncJobView } from "@/lib/sync-jobs/types";
import { overallProgress } from "@/lib/sync-jobs/view";
import { describeJobTitle } from "./describe-account-progress";
import { ProgressBar } from "./progress-bar";
import { SyncAccountProgressRow } from "./sync-account-progress-row";

const PANEL_LABEL = "Avanzamento sincronizzazione";
const DISMISS_LABEL = "Chiudi riepilogo";
const TOGGLE_LABEL = "Mostra o nascondi i dettagli";
const CATEGORIZE_LABEL = "Categorizza";

export interface SyncProgressPanelProps {
  jobs: SyncJobView[];
  onDismiss: (jobId: string) => void;
  /** Destination of the link shown when transactions to categorise remain. */
  categorizeHref?: string;
}

/** Floating panel with the progress of the sync jobs; one box per job, closable only once the job has finished. */
export function SyncProgressPanel({ jobs, onDismiss, categorizeHref = "/categorizza" }: SyncProgressPanelProps) {
  if (jobs.length === 0) return null;
  return (
    <section
      aria-label={PANEL_LABEL}
      className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96"
    >
      {jobs.map((job) => (
        <SyncJobCard key={job.id} job={job} onDismiss={onDismiss} categorizeHref={categorizeHref} />
      ))}
    </section>
  );
}

function SyncJobCard({
  job,
  onDismiss,
  categorizeHref,
}: {
  job: SyncJobView;
  onDismiss: (jobId: string) => void;
  categorizeHref: string;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const detailsId = React.useId();
  const isRunning = job.status === "running";
  const progress = overallProgress(job);
  const uncategorized = job.accounts.reduce((sum, account) => sum + account.uncategorized, 0);
  const title = describeJobTitle(job);

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          title={TOGGLE_LABEL}
          className="flex flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronDown
            size={16}
            className={cn("shrink-0 text-muted-foreground motion-safe:transition-transform", !expanded && "-rotate-90")}
          />
          <span className="text-sm font-medium" aria-live="polite">
            {title}
          </span>
        </button>
        {!isRunning && (
          <button
            type="button"
            onClick={() => onDismiss(job.id)}
            aria-label={DISMISS_LABEL}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {isRunning && (
        <ProgressBar
          className="mt-2"
          label={title}
          state={
            progress.kind === "determinate"
              ? { kind: "determinate", value: progress.processed, max: progress.total }
              : { kind: "indeterminate" }
          }
        />
      )}

      {expanded && (
        <ul id={detailsId} className="mt-3 flex max-h-64 flex-col gap-3 overflow-y-auto">
          {job.accounts.map((account) => (
            <SyncAccountProgressRow key={account.accountId} account={account} interrupted={job.interrupted} />
          ))}
        </ul>
      )}

      {!isRunning && uncategorized > 0 && (
        <Link
          href={categorizeHref}
          className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {CATEGORIZE_LABEL}
        </Link>
      )}
    </div>
  );
}
```

`components/domain/sync/sync-progress-indicator.tsx`:

```tsx
"use client";

import { useDismissSyncJobMutation, useInvalidateOnSyncJobFinish, useSyncJobsQuery } from "@/lib/queries/sync-jobs";
import { SyncProgressPanel } from "./sync-progress-panel";

/** Panel container: reads the jobs, refreshes the data at the end of a job and handles closing. Must be mounted only once in the layout. */
export function SyncProgressIndicator() {
  const { data: jobs } = useSyncJobsQuery();
  const dismiss = useDismissSyncJobMutation();
  useInvalidateOnSyncJobFinish(jobs);

  return <SyncProgressPanel jobs={jobs ?? []} onDismiss={(jobId) => dismiss.mutate(jobId)} />;
}
```

`components/domain/sync/index.ts`:

```ts
/**
 * components/domain/sync — barrel file
 *
 * Global progress panel for the bank sync jobs.
 */

export { SyncProgressIndicator } from "./sync-progress-indicator";
export { SyncProgressPanel } from "./sync-progress-panel";
export type { SyncProgressPanelProps } from "./sync-progress-panel";
export { SyncAccountProgressRow } from "./sync-account-progress-row";
export type { SyncAccountProgressRowProps } from "./sync-account-progress-row";
export { ProgressBar } from "./progress-bar";
export type { ProgressBarProps } from "./progress-bar";
export { describeAccountProgress, describeJobTitle } from "./describe-account-progress";
export type { AccountProgressDescription, ProgressBarState } from "./describe-account-progress";
```

- [ ] **Step 4: Mount the panel in the layout**

`app/(app)/layout.tsx`:

```tsx
import { AppShell } from "@/components/layout";
import { SyncProgressIndicator } from "@/components/domain/sync";

/** Layout for all authenticated app pages: mounts AppShell with the sidebar and the global sync panel. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <SyncProgressIndicator />
    </>
  );
}
```

- [ ] **Step 5: Check**

Run: `pnpm test components/domain/sync` → Expected: PASS.
Run: `pnpm exec tsc --noEmit` → Expected: no errors.
Run: `pnpm lint` → Expected: no new errors (only the 2 pre-existing `react-hooks/set-state-in-effect` remain).

- [ ] **Step 6: Commit**

```bash
git add components/domain/sync "app/(app)/layout.tsx"
git commit -m "feat: pannello globale di avanzamento dei sync bancari"
```

---

### Task 11: Wiring the starting points + documentation

**Files:**
- Modify: `app/(app)/conti/collega/[connectionId]/page.tsx:129-131` (Conferma (Confirm) button)
- Modify: `components/domain/accounts/account-row.tsx` (props + sync button)
- Modify: `app/(app)/conti/page.tsx` (passes `syncing`)
- Modify: `CLAUDE.md` (project status + log)

**Interfaces:**
- Consumes: `useSyncJobsQuery` (Task 9), `isAccountSyncing` (Task 1).
- Produces: `AccountRowProps.syncing?: boolean`.

- [ ] **Step 1: "Conferma" button**

In `app/(app)/conti/collega/[connectionId]/page.tsx`, above the component:

```ts
const CONFIRM_LABEL = "Conferma";
const CONFIRM_PENDING_LABEL = "Avvio…";
```

and replace the button:

```tsx
      <Button onClick={handleConfirm} disabled={finalize.isPending}>
        {finalize.isPending ? CONFIRM_PENDING_LABEL : CONFIRM_LABEL}
      </Button>
```

The `onSuccess` stays `router.push("/conti")`: now it arrives immediately, and the panel shows the import.

- [ ] **Step 2: `AccountRow` with a `syncing` prop**

In `components/domain/accounts/account-row.tsx`:

1. Add to `AccountRowProps`, after `syncInfo`:

```ts
  /** True if the account has a sync in progress (even one started from another page or tab). */
  syncing?: boolean;
```

2. Add `syncing = false` to the props destructuring of `AccountRow`.

3. Change the signature of `buildSyncButtonTitle` adding the parameter `syncing: boolean` and, as the first line of the body:

```ts
  if (syncing) return "Sincronizzazione in corso";
```

4. In the sync button:

```tsx
            onClick={() => syncMutation.mutate(account.id)}
            disabled={!syncInfo?.eligible || syncMutation.isPending || syncing || needsReconnect}
            title={buildSyncButtonTitle(syncInfo, needsReconnect, syncing)}
```

```tsx
            <RefreshCw size={15} className={syncMutation.isPending || syncing ? "motion-safe:animate-spin" : undefined} />
```

Update the JSDoc of the button/function if it mentions only `syncInfo`.

- [ ] **Step 3: Conti (Accounts) page**

In `app/(app)/conti/page.tsx`:

```ts
import { useSyncJobsQuery } from "@/lib/queries/sync-jobs";
import { isAccountSyncing } from "@/lib/sync-jobs/view";
```

Next to `useBankConnectionsStatusQuery()`:

```ts
  const { data: syncJobs } = useSyncJobsQuery();
```

And in `<AccountRow ...>`:

```tsx
              syncing={isAccountSyncing(syncJobs ?? [], account.id)}
```

- [ ] **Step 4: Full check**

Run: `pnpm exec tsc --noEmit` → Expected: no errors.
Run: `pnpm lint` → Expected: no new errors.
Run: `pnpm test` → Expected: all green except the 3 pre-existing ones in `lib/gocardless/scheduler.test.ts`.
Run: `pnpm build` → Expected: successful build, routes `/api/sync-jobs` and `/api/sync-jobs/[id]/dismiss` present in the list.

- [ ] **Step 5: Update CLAUDE.md**

In "Stato del progetto" (Project status) replace the sentence starting with `**In corso ora**: brainstorming (2026-09-22) di **import/sync GoCardless veloce con avanzamento visibile**` up to `poi piano con \`superpowers:writing-plans\`.` with:

```markdown
**In progress now**: no active plan. **GoCardless import/sync as a background job with visible progress completed** (plan `docs/superpowers/plans/2026-09-22-gocardless-sync-job-progress.md`, 11/11 tasks) — first case of the "Operazioni lunghe" (Long-running operations) standard. **Manual user verification still to do** (on Vercel): multi-account import changing page during the sync, "Importati X di Y" counter advancing, summary and persistent closing, double click on manual sync → "già in corso" (already running), balances/lists updated at the end of the job, import time before/after.
```

Add at the top of the "Log delle decisioni" (Decision log):

```markdown
- **<completion date>** — Completed the GoCardless sync as a background job plan (`docs/superpowers/plans/2026-09-22-gocardless-sync-job-progress.md`). Chunked inserts of 50 with `RETURNING externalId` (rule hits only on inserted rows), accounts in parallel, GoCardless token in memory, job state on Redis with **one key per account** (avoids lost updates between parallel accounts — a correction to the spec that emerged while writing the plan), 60s heartbeat, per-account lock shared with the scheduler, routes that respond immediately (`202`/`201 { jobId }`) and work in `after()` with `maxDuration = 300`, global `SyncProgressIndicator` panel mounted in `app/(app)/layout.tsx`. The success toast of the manual sync was removed (the feedback is in the panel); the toasts for immediate errors remain. Finalize now validates all the `existing` selections before writing anything (before, a 404 halfway left partial updates).
```

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/conti/collega/[connectionId]/page.tsx" components/domain/accounts/account-row.tsx "app/(app)/conti/page.tsx" CLAUDE.md
git commit -m "feat: collega Conti trovati e riga conto al pannello di avanzamento"
```
