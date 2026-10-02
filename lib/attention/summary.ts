import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import type { AttentionSummary } from "./types";

/** Tetto agli id delle transazioni nuove restituiti: la card ne usa solo pochi, il conteggio resta esatto. */
export const ATTENTION_NEW_IDS_LIMIT = 200;

/**
 * Calcola il riepilogo "da sistemare" dell'utente con sole query di conteggio. Una transazione è "nuova" se è
 * stata importata dal collegamento bancario (`source = auto`) dopo `movementsSeenAt`: i movimenti inseriti a mano
 * non contano, li ha appena scritti l'utente.
 */
export async function computeAttentionSummary(userId: string): Promise<AttentionSummary> {
  const [user] = await db
    .select({ seenAt: authUser.movementsSeenAt })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);
  if (!user) return { newCount: 0, uncategorizedCount: 0, totalCount: 0, newTransactionIds: [] };

  const fallbackIds = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));

  const isNew = and(eq(transactions.source, "auto"), gt(transactions.createdAt, user.seenAt));
  const isUncategorized = inArray(transactions.categoryId, fallbackIds);

  const [counts] = await db
    .select({
      newCount: sql<number>`count(*) filter (where ${isNew})::int`,
      uncategorizedCount: sql<number>`count(*) filter (where ${isUncategorized})::int`,
      totalCount: sql<number>`count(*) filter (where (${isNew}) or (${isUncategorized}))::int`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  const newRows =
    counts.newCount > 0
      ? await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(and(eq(transactions.userId, userId), isNew))
          .limit(ATTENTION_NEW_IDS_LIMIT)
      : [];

  return { ...counts, newTransactionIds: newRows.map((row) => row.id) };
}
