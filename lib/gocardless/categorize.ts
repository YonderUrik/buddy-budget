import { and, desc, eq, ilike, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";

export const FALLBACK_CATEGORY_NAME = "Da categorizzare";

/** Id della categoria di fallback dell'utente, creata al volo se non esiste ancora. */
export async function getFallbackCategoryId(userId: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, FALLBACK_CATEGORY_NAME)));
  if (existing) return existing.id;

  const [created] = await db
    .insert(categories)
    .values({ userId, name: FALLBACK_CATEGORY_NAME, type: "variabile" })
    .returning();
  return created.id;
}

/** Categoria dell'ultima transazione con la stessa descrizione (case-insensitive), se già categorizzata. */
async function matchCategoryId(userId: string, description: string, fallbackId: string): Promise<string | null> {
  const [match] = await db
    .select({ categoryId: transactions.categoryId })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        ilike(transactions.description, description),
        ne(transactions.categoryId, fallbackId)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(1);
  return match?.categoryId ?? null;
}

/** Categoria da assegnare a una transazione importata: match su descrizione esistente, altrimenti fallback. */
export async function resolveCategoryId(userId: string, description: string): Promise<string> {
  const fallbackId = await getFallbackCategoryId(userId);
  const matched = await matchCategoryId(userId, description, fallbackId);
  return matched ?? fallbackId;
}
