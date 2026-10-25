import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { tradeRepublicConnections } from "@/lib/db/schema/trade-republic";
import { getFallbackCategoryId } from "@/lib/categorization/fallback";
import { categorizeNewMovementsSafely } from "@/lib/categorization/auto-apply";
import { redisSyncJobStore as store } from "@/lib/sync-jobs/redis-store";
import { getUserCurrency } from "@/lib/investments/operations";
import { queuedAccount } from "@/lib/sync-jobs/types";
import { logger, recordTradeRepublicRequest } from "@/lib/observability";
import { createTradeRepublicClient, TradeRepublicError } from "./client";
import { openTradeRepublicSession, sealTradeRepublicSession } from "./session";
import { openTradeRepublicReader } from "./socket";
import { readTradeRepublicCash } from "./data";
import { describeError, tradeRepublicDebug } from "./debug";

/** Reserve the existing global sync job and account lock before scheduling background work. */
export async function prepareTradeRepublicSync(userId: string, accountId: string, initial = false) {
  const [connection] = await db.select({ id: tradeRepublicConnections.id, status: tradeRepublicConnections.status }).from(tradeRepublicConnections).where(and(eq(tradeRepublicConnections.userId, userId), eq(tradeRepublicConnections.accountId, accountId)));
  if (!connection) return { status: "not-found" as const };
  if (connection.status !== "linked") return { status: "expired" as const };
  if (!await store.acquireAccountLock(accountId)) return { status: "already-running" as const };
  try {
    const job = await store.createJob({ userId, kind: initial ? "initial-import" : "manual-sync", accounts: [queuedAccount(accountId, "Trade Republic")] });
    return { status: "started" as const, job };
  } catch (error) { await store.releaseAccountLock(accountId); throw error; }
}

/** Import direct API cash data atomically. Existing categorizations and notes survive repeated syncs. */
export async function runTradeRepublicSync(userId: string, accountId: string, jobId: string): Promise<void> {
  const started = performance.now();
  const update = (patch: Parameters<typeof store.updateAccount>[3]) => store.updateAccount(userId, jobId, accountId, patch);
  const heartbeat = setInterval(() => { void update({}).catch(() => {}); }, 15_000);
  let activeSession: string | undefined;
  let reader: Awaited<ReturnType<typeof openTradeRepublicReader>> | undefined;
  try {
    const [connection] = await db.select().from(tradeRepublicConnections).where(and(eq(tradeRepublicConnections.userId, userId), eq(tradeRepublicConnections.accountId, accountId)));
    tradeRepublicDebug("sync.start", { jobId, connection: !!connection, status: connection?.status ?? null });
    if (!connection) throw new TradeRepublicError("expired");
    activeSession = connection.session;
    const currency = await getUserCurrency(userId);
    if (currency !== "EUR") { tradeRepublicDebug("rejected", { check: "user-currency", currency }); throw new TradeRepublicError("invalid-response"); }
    const session = openTradeRepublicSession(connection.session);
    tradeRepublicDebug("sync.session_opened", { cookieCount: Object.keys(session.cookies).length });
    await update({ phase: "balance" });
    await createTradeRepublicClient(session).refresh();
    tradeRepublicDebug("sync.refreshed", { cookieCount: Object.keys(session.cookies).length });
    reader = await openTradeRepublicReader(session);
    await update({ phase: "fetching" });
    const data = await readTradeRepublicCash(reader, new Date().toISOString().slice(0, 10), async processed => { await update({ processed }); });
    reader.close(); reader = undefined;
    tradeRepublicDebug("sync.fetched", { movements: data.movements.length, investmentEvents: data.investmentEvents });
    const categoryId = await getFallbackCategoryId(userId);
    await update({ phase: "saving", total: data.movements.length, processed: 0 });
    const inserted = await db.transaction(async tx => {
      // Serialize with reconnects and deletion; verify ownership and the session again under the lock.
      const [owned] = await tx.select().from(tradeRepublicConnections).where(and(eq(tradeRepublicConnections.id, connection.id), eq(tradeRepublicConnections.userId, userId))).for("update");
      if (!owned || owned.session !== connection.session) { tradeRepublicDebug("rejected", { check: "session-changed", owned: !!owned }); throw new TradeRepublicError("unavailable"); }
      let count = 0;
      for (let start = 0; start < data.movements.length; start += 50) {
        const chunk = data.movements.slice(start, start + 50);
        const created = await tx.insert(transactions).values(chunk.map(movement => ({ userId, accountId, categoryId, description: movement.description, rawDescription: movement.description, date: movement.date, amount: movement.amount, source: "auto" as const, externalId: `trade-republic:${movement.id}` }))).onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] }).returning({ id: transactions.id });
        count += created.length;
        await update({ processed: Math.min(start + 50, data.movements.length) });
      }
      await tx.update(accounts).set({ balance: data.balance, updatedAt: new Date() }).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
      await tx.update(tradeRepublicConnections).set({ session: sealTradeRepublicSession(session), lastSyncedAt: new Date(), status: "linked" }).where(eq(tradeRepublicConnections.id, connection.id));
      return count;
    });
    await categorizeNewMovementsSafely(userId);
    await update({ phase: "done", inserted, processed: data.movements.length });
    recordTradeRepublicRequest("sync", "success", performance.now() - started);
    logger.info("trade_republic.sync.completed", { inserted, skipped: data.investmentEvents });
  } catch (error) {
    const expired = error instanceof TradeRepublicError && error.reason === "expired";
    tradeRepublicDebug("sync.error", error instanceof TradeRepublicError ? { reason: error.reason } : { reason: "internal", error: describeError(error) });
    if (expired && activeSession) await db.update(tradeRepublicConnections).set({ status: "expired", session: "" }).where(and(eq(tradeRepublicConnections.userId, userId), eq(tradeRepublicConnections.accountId, accountId), eq(tradeRepublicConnections.session, activeSession)));
    await update({ phase: expired ? "expired" : "error" });
    recordTradeRepublicRequest("sync", "error", performance.now() - started);
    // Provider bodies and cookies must never enter logs, including on network failures.
    logger.warn("trade_republic.sync.failed", { reason: error instanceof TradeRepublicError ? error.reason : "internal" });
  } finally { clearInterval(heartbeat); reader?.close(); await store.releaseAccountLock(accountId); }
}
