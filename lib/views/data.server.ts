import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts, type Account } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { budgets, type Budget } from "@/lib/db/schema/budgets";
import { categories, type Category } from "@/lib/db/schema/categories";
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";
import { localizeCategory } from "@/lib/localization/categories";
import type { LocaleProfile } from "@/lib/localization/config";

/** The user's accounts, oldest first (`GET /api/accounts`). */
export function loadUserAccounts(userId: string): Promise<Account[]> {
  return db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(asc(accounts.createdAt));
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
  status: "pending" | "linked" | "expired" | "error";
  consentExpiresAt: string | null;
  lastSyncedAt: string | null;
  eligible: boolean;
  nextEligibleAt: string | null;
  syncsRemainingToday: number;
}

/** One row per linked account: its connection, consent expiry, last sync and whether a manual sync is allowed now. */
export async function loadBankConnectionStatuses(userId: string, now: Date): Promise<BankConnectionStatus[]> {
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
      consentExpiresAt: consentExpiresAt?.toISOString() ?? null,
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      eligible: eligibility.eligible,
      nextEligibleAt: eligibility.nextEligibleAt?.toISOString() ?? null,
      syncsRemainingToday: eligibility.syncsRemainingToday,
    };
  });
}
