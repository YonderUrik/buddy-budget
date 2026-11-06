import "server-only";
import { createHash } from "node:crypto";
import { and, eq, max, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { ibkrFlexConnections, type IbkrFlexConnection, type IbkrFlexConnectionError } from "@/lib/db/schema/ibkr-flex";
import { redis } from "@/lib/redis/client";
import { todayKey } from "@/lib/investments/operations";
import { ibkrFlexAccountOf, IbkrFlexReportError, parseIbkrFlexReport } from "@/lib/investments/import/ibkr-flex";
import { sealFlexToken } from "./availability";
import { fetchFlexReport, IbkrFlexError, type IbkrFlexClientDeps, type IbkrFlexCredentials } from "./client";
import type { RateWindowStore } from "./rate-limit";
import { shiftDay } from "./windows";

/** Redis counters for IBKR's SendRequest limits, shared by every pod and the cron. */
export const redisRateWindowStore: RateWindowStore = {
  async increment(key, ttlSeconds) {
    const [[, count]] = (await redis.multi().incr(key).expire(key, ttlSeconds).exec()) as [[unknown, number], [unknown, unknown]];
    return count;
  },
};
export const flexClientDeps = (): IbkrFlexClientDeps => ({ rateStore: redisRateWindowStore });

/** The statement import's account key: one history per IBKR account, whether it came from a CSV or from Flex. */
export function ibkrAccountKey(accountId: string): string {
  return createHash("sha256").update(accountId).digest("hex");
}

/** Days the connect check reads: a short recent report, enough to read the account and the query's sections. */
const CHECK_DAYS = 7;

/** The connection error for a report that is not a usable statement. */
export function reportReason(error: IbkrFlexReportError): IbkrFlexConnectionError {
  return error.code === "not_flex" || error.code === "malformed" ? "invalid_response" : error.code;
}

export type ConnectOutcome =
  | { status: "connected"; connectionId: string; reconnected: boolean; periodHonoured: boolean }
  | { status: "refused"; reason: IbkrFlexConnectionError; sections?: string[] };

/**
 * Check a token and query id by generating a short report, then store the connection with the token encrypted.
 * Connecting the same IBKR account again replaces its token and query (a reconnect), never adds a second connection.
 */
export async function connectIbkrFlex(userId: string, credentials: IbkrFlexCredentials, deps: IbkrFlexClientDeps = flexClientDeps()): Promise<ConnectOutcome> {
  const through = shiftDay(todayKey(), -1);
  let account: ReturnType<typeof ibkrFlexAccountOf>;
  const check = { from: shiftDay(through, -(CHECK_DAYS - 1)), to: through };
  try {
    const xml = await fetchFlexReport(credentials, check, deps);
    account = ibkrFlexAccountOf(xml);
    // The structural checks of a real import (sections, dates, one account). A row the shared reader refuses is a
    // data problem, not a configuration one: the sync reports it with the reader's message.
    try { parseIbkrFlexReport(xml, todayKey()); } catch (error) { if (error instanceof IbkrFlexReportError) throw error; }
  } catch (error) {
    if (error instanceof IbkrFlexError) return { status: "refused", reason: error.reason };
    if (error instanceof IbkrFlexReportError) return { status: "refused", reason: reportReason(error), sections: error.sections };
    throw error;
  }
  const accountKey = ibkrAccountKey(account.accountId);
  // Whether IBKR used the requested period (`fd`/`td`) or the query's own: the sync relies on the first.
  const periodHonoured = account.from === check.from && account.to === check.to;
  const token = sealFlexToken(credentials.token);
  return db.transaction(async (tx) => {
    // Same per-user lock as broker statement imports: a connect never interleaves with an import of this account.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const [existing] = await tx.select({ id: ibkrFlexConnections.id }).from(ibkrFlexConnections).where(and(eq(ibkrFlexConnections.userId, userId), eq(ibkrFlexConnections.accountKey, accountKey)));
    const fields = { token, queryId: credentials.queryId, baseCurrency: account.currency, dateOpened: account.dateOpened, status: "linked" as const, lastError: null, lastErrorDetail: null, failures: 0, nextAttemptAt: null };
    if (existing) {
      await tx.update(ibkrFlexConnections).set(fields).where(eq(ibkrFlexConnections.id, existing.id));
      return { status: "connected" as const, connectionId: existing.id, reconnected: true, periodHonoured };
    }
    const [created] = await tx.insert(ibkrFlexConnections).values({ userId, accountKey, accountLabel: account.accountId.slice(-4), ...fields }).returning({ id: ibkrFlexConnections.id });
    return { status: "connected" as const, connectionId: created.id, reconnected: false, periodHonoured };
  });
}

/** What the UI may see of a connection: never the token or the query id. */
export interface IbkrFlexConnectionView {
  id: string;
  accountLabel: string;
  baseCurrency: string;
  status: IbkrFlexConnection["status"];
  lastError: IbkrFlexConnectionError | null;
  lastErrorDetail: string | null;
  /** Last day of the latest imported statement of this account (CSV or Flex). */
  syncedThrough: string | null;
  lastSyncedAt: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
}

/** The user's connections, safe for the client. */
export async function listIbkrFlexConnections(userId: string): Promise<IbkrFlexConnectionView[]> {
  const rows = await db.select({
    id: ibkrFlexConnections.id, accountLabel: ibkrFlexConnections.accountLabel, baseCurrency: ibkrFlexConnections.baseCurrency, status: ibkrFlexConnections.status,
    lastError: ibkrFlexConnections.lastError, lastErrorDetail: ibkrFlexConnections.lastErrorDetail, lastSyncedAt: ibkrFlexConnections.lastSyncedAt,
    lastAttemptAt: ibkrFlexConnections.lastAttemptAt, nextAttemptAt: ibkrFlexConnections.nextAttemptAt, accountKey: ibkrFlexConnections.accountKey,
  }).from(ibkrFlexConnections).where(eq(ibkrFlexConnections.userId, userId)).orderBy(ibkrFlexConnections.createdAt);
  const covered = rows.length ? await db.select({ accountKey: brokerStatements.accountKey, to: max(brokerStatements.to) }).from(brokerStatements).where(eq(brokerStatements.userId, userId)).groupBy(brokerStatements.accountKey) : [];
  const iso = (value: Date | null) => value?.toISOString() ?? null;
  return rows.map(({ accountKey, ...row }) => ({ ...row, syncedThrough: covered.find((c) => c.accountKey === accountKey)?.to ?? null, lastSyncedAt: iso(row.lastSyncedAt), lastAttemptAt: iso(row.lastAttemptAt), nextAttemptAt: iso(row.nextAttemptAt) }));
}

/**
 * Remove the connection and its stored token. Imported statements, operations and the broker cash account stay:
 * they are the user's history, deleted from «Gestisci importazioni» like any other import.
 */
export async function disconnectIbkrFlex(userId: string, connectionId: string): Promise<boolean> {
  const removed = await db.delete(ibkrFlexConnections).where(and(eq(ibkrFlexConnections.id, connectionId), eq(ibkrFlexConnections.userId, userId))).returning({ id: ibkrFlexConnections.id });
  return removed.length > 0;
}

