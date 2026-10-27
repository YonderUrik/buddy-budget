import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts, type Account } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { tradeRepublicConnections } from "@/lib/db/schema/trade-republic";
import { budgets, type Budget } from "@/lib/db/schema/budgets";
import { categories, type Category } from "@/lib/db/schema/categories";
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";
import { localizeCategory } from "@/lib/localization/categories";
import { importAccountIds } from "@/lib/net-worth/snapshots";
import type { LocaleProfile } from "@/lib/localization/config";

/**
 * The user's accounts, oldest first (`GET /api/accounts`), each with `followsTransactions`: linked banks and file
 * imports move their balance with their transactions, so their trend can be drawn day by day.
 */
export async function loadUserAccounts(userId: string): Promise<Array<Account & { followsTransactions: boolean }>> {
  const [rows, imported] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(asc(accounts.createdAt)),
    importAccountIds(userId),
  ]);
  return rows.map((a) => ({ ...a, followsTransactions: a.source === "auto" || imported.has(a.id) }));
}

/** The user's monthly budgets (`GET /api/budgets`). */
export function loadUserBudgets(userId: string): Promise<Budget[]> {
  return db.select().from(budgets).where(eq(budgets.userId, userId));
}

/**
 * The user's categories, oldest first (`GET /api/categories`), with default names and descriptions in the profile's
 * language (`localizeCategory`, gaps.md G11). Presentation only: ids and stored names stay unchanged, and the web's own
 * client-side localization is idempotent on these values.
 */
export async function loadUserCategories(userId: string, profile: LocaleProfile): Promise<Category[]> {
  const rows = await db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.createdAt));
  return rows.map((row) => localizeCategory(row, profile));
}

/** Status of one linked account's bank connection, as `GET /api/gocardless/connections` serves it (ISO timestamps). */
export interface BankConnectionStatus {
  accountId: string;
  connectionId: string;
  institutionName: string;
  /** Which sync route the account uses: `/api/{provider}/accounts/{id}/sync`. */
  provider: "gocardless" | "trade-republic";
  status: "pending" | "linked" | "expired" | "error";
  consentExpiresAt: string | null;
  lastSyncedAt: string | null;
  eligible: boolean;
  nextEligibleAt: string | null;
  syncsRemainingToday: number;
}

/**
 * One row per linked account: its connection, consent expiry, last sync and whether a manual sync is allowed now.
 * Trade Republic accounts are included with `provider: "trade-republic"` (no consent expiry, no daily sync budget).
 */
export async function loadBankConnectionStatuses(userId: string, now: Date): Promise<BankConnectionStatus[]> {
  const [gocardless, tradeRepublic] = await Promise.all([loadGoCardlessStatuses(userId, now), loadTradeRepublicStatuses(userId)]);
  return [...gocardless, ...tradeRepublic];
}

async function loadTradeRepublicStatuses(userId: string): Promise<BankConnectionStatus[]> {
  const rows = await db
    .select({ accountId: tradeRepublicConnections.accountId, connectionId: tradeRepublicConnections.id, status: tradeRepublicConnections.status, lastSyncedAt: tradeRepublicConnections.lastSyncedAt })
    .from(tradeRepublicConnections)
    .where(eq(tradeRepublicConnections.userId, userId));
  return rows.map((row) => ({
    ...row,
    institutionName: "Trade Republic",
    provider: "trade-republic" as const,
    consentExpiresAt: null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    eligible: row.status === "linked",
    nextEligibleAt: null,
    syncsRemainingToday: row.status === "linked" ? 1 : 0,
  }));
}

/** GoCardless links only (`GET /api/gocardless/connections`: web reads Trade Republic from its own route). */
export async function loadGoCardlessStatuses(userId: string, now: Date): Promise<BankConnectionStatus[]> {
  const rows = await db
    .select({
      accountId: bankAccountLinks.accountId,
      connectionId: bankConnections.id,
      institutionName: bankConnections.institutionName,
      status: bankConnections.status,
      consentExpiresAt: bankConnections.consentExpiresAt,
      lastSyncedAt: bankAccountLinks.lastSyncedAt,
      syncTimestamps: bankAccountLinks.syncTimestamps,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(eq(bankConnections.userId, userId));
  return rows.map(({ syncTimestamps, consentExpiresAt, lastSyncedAt, ...row }) => {
    const eligibility = computeSyncEligibility(syncTimestamps.map((t) => new Date(t)), now);
    return {
      ...row,
      provider: "gocardless" as const,
      consentExpiresAt: consentExpiresAt?.toISOString() ?? null,
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      eligible: eligibility.eligible,
      nextEligibleAt: eligibility.nextEligibleAt?.toISOString() ?? null,
      syncsRemainingToday: eligibility.syncsRemainingToday,
    };
  });
}
