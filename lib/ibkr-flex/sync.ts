import "server-only";
import { and, asc, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { ibkrFlexConnections, type IbkrFlexConnectionError } from "@/lib/db/schema/ibkr-flex";
import { ibkrFlexAccountOf, IbkrFlexReportError, parseIbkrFlexReport } from "@/lib/investments/import/ibkr-flex";
import { investmentImportDeps } from "@/lib/investments/import/deps";
import { resolveIdentity } from "@/lib/investments/import/resolve";
import { todayKey } from "@/lib/investments/operations";
import { searchByIsinOnProviders, searchCryptoOnProviders, searchInstrumentsOnProviders } from "@/lib/market-data/runtime";
import { importNatively, type NativeOutcome } from "@/lib/personal-import/native";
import { patientSearches } from "@/lib/personal-import/patient-search";
import { TransientError } from "@/lib/personal-import/errors";
import { redisSyncJobStore as store } from "@/lib/sync-jobs/redis-store";
import { queuedAccount, type SyncJobKind } from "@/lib/sync-jobs/types";
import { logger, recordIbkrFlexRequest } from "@/lib/observability";
import { openFlexToken } from "./availability";
import { CREDENTIAL_REASONS, fetchFlexReport, IbkrFlexError, type IbkrFlexClientDeps } from "./client";
import { flexClientDeps, ibkrAccountKey, reportReason } from "./connections";
import { lastClosedDay, planWindows } from "./windows";

/** Stop starting new reports past this point, so a run ends inside a route's `maxDuration` (300 s); the rest resumes. */
export const SYNC_TIME_BUDGET_MS = 200_000;
/** A successful sync waits this long before the cron tries again (the cron is hourly: about once a day). */
const NEXT_SYNC_MS = 20 * 60 * 60_000;
/** A run cut by the time budget continues soon. */
const RESUME_MS = 5 * 60_000;
/** Backoff of automatic syncs after consecutive failures: 1 h, 2 h, 4 h… up to a day. */
export function retryDelayMs(failures: number): number {
  return Math.min(24 * 60 * 60_000, 60 * 60_000 * 2 ** Math.max(0, failures - 1));
}

class SyncFailure extends Error {
  constructor(public readonly reason: IbkrFlexConnectionError, public readonly detail: string | null = null, public readonly ibkrCode: number | null = null) { super(reason); }
}

export interface IbkrFlexSyncDeps {
  client: IbkrFlexClientDeps;
  /** Saves one report through the statement import (reconciled, all or nothing). */
  importReport(userId: string, xml: string): Promise<NativeOutcome>;
  now(): Date;
  budgetMs?: number;
}

/** The real dependencies: the shared import with automatic security matching, as for an uploaded statement. */
export function ibkrFlexSyncDeps(): IbkrFlexSyncDeps {
  return {
    client: flexClientDeps(),
    importReport: async (userId, xml) => importNatively(userId, xml, {
      importDeps: await investmentImportDeps(userId, (task) => { void task().catch(() => {}); }),
      resolve: (identity) => resolveIdentity(userId, identity, patientSearches({ searchMarket: searchInstrumentsOnProviders, searchCrypto: searchCryptoOnProviders, searchByIsin: searchByIsinOnProviders })),
    }),
    now: () => new Date(),
  };
}

export type IbkrFlexSyncOutcome =
  | { status: "done"; reports: number; inserted: number; through: string | null; partial: boolean }
  | { status: "failed"; reason: IbkrFlexConnectionError; expired: boolean }
  | { status: "not-found" };

/**
 * Bring one connection up to the last closed day (yesterday, or Friday over a weekend): request each missing period (`planWindows`), check it is the connected
 * account and a complete statement, and save it through the reconciled statement import, oldest first.
 *
 * Idempotent and resumable: each report is saved atomically and replaces only periods it fully covers, a report
 * identical to a saved one is skipped, and a run cut short resumes from the latest saved period. A report that does
 * not reconcile, is empty where history exists or belongs to another account is never saved, so valid history
 * is never deleted. Credentials refused by IBKR stop the automatic syncs until the user reconnects.
 */
export async function syncIbkrFlexConnection(userId: string, connectionId: string, deps: IbkrFlexSyncDeps, onProgress?: (done: number, total: number) => Promise<void>): Promise<IbkrFlexSyncOutcome> {
  const started = deps.now().getTime();
  const [connection] = await db.select().from(ibkrFlexConnections).where(and(eq(ibkrFlexConnections.id, connectionId), eq(ibkrFlexConnections.userId, userId)));
  if (!connection) return { status: "not-found" };
  const log = logger.child({ connectionId });
  if (connection.status === "expired" || !connection.token) return { status: "failed", reason: connection.lastError ?? "token_expired", expired: true };
  await db.update(ibkrFlexConnections).set({ lastAttemptAt: deps.now() }).where(eq(ibkrFlexConnections.id, connection.id));
  let reports = 0, inserted = 0, through: string | null = null, partial = false;
  try {
    const credentials = { token: openFlexToken(connection.token), queryId: connection.queryId };
    const existing = await db.select({ from: brokerStatements.from, to: brokerStatements.to }).from(brokerStatements).where(and(eq(brokerStatements.userId, userId), eq(brokerStatements.accountKey, connection.accountKey)));
    const windows = planWindows({ existing, through: lastClosedDay(todayKey()), dateOpened: connection.dateOpened });
    await onProgress?.(0, windows.length);
    for (const window of windows) {
      if (reports > 0 && deps.now().getTime() - started > (deps.budgetMs ?? SYNC_TIME_BUDGET_MS)) { partial = true; break; }
      const xml = await fetchFlexReport(credentials, window, deps.client);
      const account = ibkrFlexAccountOf(xml);
      if (ibkrAccountKey(account.accountId) !== connection.accountKey) throw new SyncFailure("account_changed");
      try { parseIbkrFlexReport(xml, todayKey()); }
      catch (error) {
        if (error instanceof IbkrFlexReportError) throw new SyncFailure(reportReason(error), error.sections.length ? error.message : null);
        throw new SyncFailure("import_refused", error instanceof Error ? error.message : null);
      }
      let outcome: NativeOutcome;
      try { outcome = await deps.importReport(userId, xml); }
      catch (error) { if (error instanceof TransientError) throw new SyncFailure("unavailable"); throw error; }
      if (outcome.kind === "failed") throw new SyncFailure("import_refused", outcome.message);
      if (outcome.kind !== "imported") throw new SyncFailure("invalid_response");
      reports++;
      inserted += outcome.result.inserted;
      through = account.to ?? window.to;
      await onProgress?.(reports, windows.length);
      // IBKR answered with the query's own period instead of the requested one: what it sent is saved (the import
      // checks it fits), but asking again would return the same report.
      const periodHonoured = account.from === window.from && account.to === window.to;
      if (!periodHonoured) { log.warn("ibkr_flex.sync.period_mismatch", { periodHonoured }); break; }
    }
    await db.update(ibkrFlexConnections).set({ status: "linked", lastError: null, lastErrorDetail: null, failures: 0, lastSyncedAt: deps.now(), nextAttemptAt: new Date(deps.now().getTime() + (partial ? RESUME_MS : NEXT_SYNC_MS)), ...(through ? { syncedThrough: through } : {}) })
      .where(and(eq(ibkrFlexConnections.id, connection.id), eq(ibkrFlexConnections.token, connection.token)));
    recordIbkrFlexRequest("sync", "success", deps.now().getTime() - started);
    log.info("ibkr_flex.sync.completed", { count: reports, inserted, outcome: partial ? "partial" : "complete" });
    return { status: "done", reports, inserted, through, partial };
  } catch (error) {
    const failure = error instanceof SyncFailure ? error
      : error instanceof IbkrFlexError ? new SyncFailure(error.reason, null, error.code)
      : error instanceof IbkrFlexReportError ? new SyncFailure(reportReason(error))
      : new SyncFailure("internal");
    const credentialsRefused = CREDENTIAL_REASONS.has(failure.reason as never);
    const expired = failure.reason === "token_expired" || failure.reason === "token_invalid";
    const failures = connection.failures + 1;
    // Reports saved before the failure stay: they were complete and reconciled. The token changed meanwhile (a
    // reconnect) means this run's outcome no longer describes the connection.
    await db.update(ibkrFlexConnections).set({
      status: expired ? "expired" : credentialsRefused ? "error" : "linked", ...(expired ? { token: "" } : {}),
      lastError: failure.reason, lastErrorDetail: failure.detail?.slice(0, 500) ?? null, failures,
      nextAttemptAt: credentialsRefused ? null : new Date(deps.now().getTime() + retryDelayMs(failures)), ...(through ? { syncedThrough: through } : {}),
    }).where(and(eq(ibkrFlexConnections.id, connection.id), eq(ibkrFlexConnections.token, connection.token)));
    recordIbkrFlexRequest("sync", failure.reason, deps.now().getTime() - started);
    // Never the detail: the import's message can name securities and quantities.
    log.warn("ibkr_flex.sync.failed", { reason: failure.reason, ...(failure.ibkrCode ? { ibkrCode: failure.ibkrCode } : {}), count: reports, ...(failure.reason === "internal" ? { error } : {}) });
    return { status: "failed", reason: failure.reason, expired };
  }
}

/** Take the connection's lock and create the visible job, before the work is scheduled with `after()`. */
export async function prepareIbkrFlexSync(userId: string, connectionId: string, kind: SyncJobKind) {
  const [connection] = await db.select({ id: ibkrFlexConnections.id, status: ibkrFlexConnections.status, token: ibkrFlexConnections.token }).from(ibkrFlexConnections).where(and(eq(ibkrFlexConnections.id, connectionId), eq(ibkrFlexConnections.userId, userId)));
  if (!connection) return { status: "not-found" as const };
  if (connection.status === "expired" || !connection.token) return { status: "expired" as const };
  if (!await store.acquireAccountLock(lockId(connectionId))) return { status: "already-running" as const };
  try {
    const job = await store.createJob({ userId, kind, accounts: [queuedAccount(connectionId, "Interactive Brokers")] });
    return { status: "started" as const, job };
  } catch (error) { await store.releaseAccountLock(lockId(connectionId)); throw error; }
}

const lockId = (connectionId: string) => `ibkr-flex:${connectionId}`;

/** Background part of a user-started sync: progress in the global sync panel, the lock released at the end. */
export async function runIbkrFlexSyncJob(userId: string, connectionId: string, jobId: string, deps: IbkrFlexSyncDeps = ibkrFlexSyncDeps()): Promise<void> {
  const update = (patch: Parameters<typeof store.updateAccount>[3]) => store.updateAccount(userId, jobId, connectionId, patch);
  const heartbeat = setInterval(() => { void update({}).catch(() => {}); }, 15_000);
  try {
    await update({ phase: "fetching" });
    const outcome = await syncIbkrFlexConnection(userId, connectionId, deps, (done, total) => update({ phase: "fetching", processed: done, total }));
    if (outcome.status === "done") await update({ phase: "done", inserted: outcome.inserted, investmentOperations: outcome.inserted });
    else await update({ phase: outcome.status === "failed" && outcome.expired ? "expired" : "error" });
  } catch (error) {
    logger.error("ibkr_flex.sync.failed", { connectionId, reason: "internal", error });
    await update({ phase: "error" }).catch(() => {});
  } finally { clearInterval(heartbeat); await store.releaseAccountLock(lockId(connectionId)); }
}

/** Connections whose automatic sync is due, oldest attempt first. */
export async function dueIbkrFlexConnections(now: Date, limit: number) {
  return db.select({ id: ibkrFlexConnections.id, userId: ibkrFlexConnections.userId }).from(ibkrFlexConnections)
    .where(and(eq(ibkrFlexConnections.status, "linked"), ne(ibkrFlexConnections.token, ""), or(isNull(ibkrFlexConnections.nextAttemptAt), lte(ibkrFlexConnections.nextAttemptAt, now))))
    .orderBy(sql`${ibkrFlexConnections.lastAttemptAt} asc nulls first`, asc(ibkrFlexConnections.createdAt)).limit(limit);
}

/**
 * The cron's pass: sync due connections one at a time within the time budget, skipping any a user is syncing now.
 * Returns counts only.
 */
export async function runDueIbkrFlexSyncs(deps: IbkrFlexSyncDeps = ibkrFlexSyncDeps(), limit = 50): Promise<{ due: number; synced: number; failed: number; skipped: number }> {
  const started = deps.now().getTime();
  const due = await dueIbkrFlexConnections(deps.now(), limit);
  const totals = { due: due.length, synced: 0, failed: 0, skipped: 0 };
  for (const connection of due) {
    const elapsed = deps.now().getTime() - started;
    if (elapsed > (deps.budgetMs ?? SYNC_TIME_BUDGET_MS)) { totals.skipped += 1; continue; }
    if (!await store.acquireAccountLock(lockId(connection.id))) { totals.skipped += 1; continue; }
    try {
      const outcome = await syncIbkrFlexConnection(connection.userId, connection.id, { ...deps, budgetMs: Math.max(1, (deps.budgetMs ?? SYNC_TIME_BUDGET_MS) - elapsed) });
      if (outcome.status === "done") totals.synced += 1; else totals.failed += 1;
    } finally { await store.releaseAccountLock(lockId(connection.id)); }
  }
  return totals;
}
