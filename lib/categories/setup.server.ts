import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { planCategorySetup, validateCategorySetup, type CategorySetupItem } from "./setup";

export type CategorySetupResult =
  | { outcome: "applied"; deleted: number; updated: number; created: number }
  | { outcome: "skipped"; reason: "has_transactions" | "invalid" | "unchanged" };

/**
 * Applica le categorie scelte nell'onboarding, in un'unica transazione: elimina le default spente, rinomina e crea.
 * Vale solo per un utente senza movimenti (appena registrato): con movimenti già presenti non tocca nulla, così una
 * categoria in uso non si perde mai. Chi chiama decide cosa fare di un errore (l'onboarding prosegue comunque).
 */
export async function applyCategorySetup(userId: string, items: CategorySetupItem[]): Promise<CategorySetupResult> {
  const existing = await db
    .select({ id: categories.id, name: categories.name, isFallback: categories.isFallback })
    .from(categories)
    .where(eq(categories.userId, userId));
  const fallbackNames = existing.filter((category) => category.isFallback).map((category) => category.name);
  if (validateCategorySetup(items, fallbackNames)) return { outcome: "skipped", reason: "invalid" };

  const plan = planCategorySetup(existing, items);
  if (plan.deletions.length + plan.renames.length + plan.creates.length === 0) return { outcome: "skipped", reason: "unchanged" };

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  if (count > 0) return { outcome: "skipped", reason: "has_transactions" };

  await db.transaction(async (tx) => {
    if (plan.deletions.length > 0) {
      await tx.delete(categories).where(and(eq(categories.userId, userId), inArray(categories.id, plan.deletions)));
    }
    // Due passaggi, così uno scambio di nomi tra due categorie non viola l'unicità del nome.
    for (const rename of plan.renames) {
      await tx.update(categories).set({ name: `__rinomina_${rename.id}` }).where(eq(categories.id, rename.id));
    }
    for (const rename of plan.renames) {
      await tx.update(categories).set({ name: rename.name }).where(eq(categories.id, rename.id));
    }
    if (plan.creates.length > 0) {
      await tx.insert(categories).values(plan.creates.map((create) => ({ userId, ...create })));
    }
  });
  return { outcome: "applied", deleted: plan.deletions.length, updated: plan.renames.length, created: plan.creates.length };
}
