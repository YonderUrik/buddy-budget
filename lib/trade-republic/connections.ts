import "server-only";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { tradeRepublicConnections } from "@/lib/db/schema/trade-republic";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { createTradeRepublicClient, TradeRepublicError, type TradeRepublicSession } from "./client";
import { sealTradeRepublicSession } from "./session";
import { describeIssues, tradeRepublicDebug } from "./debug";

/** Verify the provider identity again on each connection, preventing cross-account reconnection. */
export async function connectTradeRepublic(userId: string, session: TradeRepublicSession) {
  const client = createTradeRepublicClient(session);
  await client.refresh();
  const result = z.object({ personId: z.string().min(1), cashAccount: z.object({ iban: z.string().min(1) }) }).safeParse(await client.account());
  if (!result.success) { tradeRepublicDebug("rejected", { check: "account-schema", issues: describeIssues(result.error.issues) }); throw new TradeRepublicError("invalid-response"); }
  const externalAccountHash = createHash("sha256").update(`${result.data.personId}:${result.data.cashAccount.iban}`).digest("hex");
  // The approval process is one-use and is no longer needed once the account has been verified.
  delete session.processId;
  const encryptedSession = sealTradeRepublicSession(session);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const [existing] = await tx.select().from(tradeRepublicConnections).where(and(eq(tradeRepublicConnections.userId, userId), eq(tradeRepublicConnections.externalAccountHash, externalAccountHash)));
    if (existing) {
      await tx.update(tradeRepublicConnections).set({ session: encryptedSession, status: "linked" }).where(eq(tradeRepublicConnections.id, existing.id));
      return existing.accountId;
    }
    const [fileSource] = await tx.select({ id: brokerImportAccounts.id }).from(brokerImportAccounts).where(and(eq(brokerImportAccounts.userId, userId), eq(brokerImportAccounts.provider, "trade-republic")));
    if (fileSource) throw new TradeRepublicError("existing-import");
    const [account] = await tx.insert(accounts).values({ userId, name: "Trade Republic", type: "Conto corrente", source: "auto", color: "slate", icon: "landmark" }).returning();
    await tx.insert(tradeRepublicConnections).values({ userId, accountId: account.id, externalAccountHash, session: encryptedSession });
    return account.id;
  });
}

/** A safe projection for account badges; authentication material never leaves the server. */
export async function listTradeRepublicConnections(userId: string) {
  const rows = await db.select({ accountId: tradeRepublicConnections.accountId, id: tradeRepublicConnections.id, status: tradeRepublicConnections.status, lastSyncedAt: tradeRepublicConnections.lastSyncedAt }).from(tradeRepublicConnections).where(eq(tradeRepublicConnections.userId, userId));
  return rows.map(row => ({ accountId: row.accountId, connectionId: row.id, provider: "trade-republic" as const, institutionName: "Trade Republic", consentExpiresAt: null, status: row.status, lastSyncedAt: row.lastSyncedAt, eligible: row.status === "linked", nextEligibleAt: null, syncsRemainingToday: 1 }));
}
