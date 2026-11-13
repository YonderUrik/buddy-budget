import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { ibkrFlexConnections } from "@/lib/db/schema/ibkr-flex";

/**
 * The connection status of each broker cash account an IBKR Flex connection feeds, in the shape of the bank
 * connection badges (like Trade Republic): the account row shows «Collegato», the last sync and a sync button.
 * A connection whose first import has not created the cash account yet has no row.
 */
export async function listIbkrFlexAccountStatuses(userId: string) {
  const rows = await db.select({ accountId: brokerImportAccounts.cashAccountId, connectionId: ibkrFlexConnections.id, status: ibkrFlexConnections.status, lastSyncedAt: ibkrFlexConnections.lastSyncedAt })
    .from(ibkrFlexConnections)
    .innerJoin(brokerImportAccounts, and(eq(brokerImportAccounts.userId, ibkrFlexConnections.userId), eq(brokerImportAccounts.accountKey, ibkrFlexConnections.accountKey), isNotNull(brokerImportAccounts.cashAccountId)))
    .where(eq(ibkrFlexConnections.userId, userId));
  return rows.map((row) => ({
    accountId: row.accountId!, connectionId: row.connectionId, provider: "ibkr-flex" as const, institutionName: "Interactive Brokers", consentExpiresAt: null,
    status: row.status, lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null, eligible: row.status !== "expired", nextEligibleAt: null, syncsRemainingToday: row.status !== "expired" ? 1 : 0,
  }));
}

/** The connection that feeds a broker cash account, if the account is the user's. */
export async function ibkrFlexConnectionForAccount(userId: string, accountId: string): Promise<string | null> {
  const [row] = await db.select({ id: ibkrFlexConnections.id }).from(ibkrFlexConnections)
    .innerJoin(brokerImportAccounts, and(eq(brokerImportAccounts.userId, ibkrFlexConnections.userId), eq(brokerImportAccounts.accountKey, ibkrFlexConnections.accountKey)))
    .where(and(eq(ibkrFlexConnections.userId, userId), eq(brokerImportAccounts.cashAccountId, accountId)));
  return row?.id ?? null;
}
