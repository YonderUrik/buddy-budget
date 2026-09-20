import { eq } from "drizzle-orm";
import { db } from "./client";
import { categories } from "./schema/categories";
import { transactions } from "./schema/transactions";
import { categorizationRules } from "./schema/categorization-rules";
import { merchantKey } from "@/lib/categorization/merchant-key";

export interface HistoryTransaction {
  description: string;
  categoryId: string;
  date: string;
  amount: string;
  excludedAmount: string;
}

export interface NewRuleSeed {
  pattern: string;
  categoryId: string;
  splitPercentage: number | null;
}

/** Quota esclusa come frazione dell'importo, arrotondata per confrontare transazioni di importo diverso. */
function splitPercentageOf(transaction: HistoryTransaction): number {
  const amount = Math.abs(Number(transaction.amount));
  if (amount === 0) return 0;
  return Math.round((Math.abs(Number(transaction.excludedAmount)) / amount) * 10000) / 10000;
}

/**
 * Regole `appresa` deducibili dallo storico già categorizzato: una per chiave merchant, con la
 * categoria più frequente (pareggio risolto sulla transazione più recente) e lo split riproposto solo
 * se coerente su tutte le transazioni della categoria vincente.
 */
export function buildRulesFromHistory(history: HistoryTransaction[]): NewRuleSeed[] {
  const byKey = new Map<string, HistoryTransaction[]>();
  for (const transaction of history) {
    const key = merchantKey(transaction.description);
    if (key.length === 0) continue;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(transaction);
    else byKey.set(key, [transaction]);
  }

  const seeds: NewRuleSeed[] = [];
  for (const [pattern, group] of byKey) {
    const countByCategory = new Map<string, number>();
    const latestDateByCategory = new Map<string, string>();
    for (const transaction of group) {
      countByCategory.set(transaction.categoryId, (countByCategory.get(transaction.categoryId) ?? 0) + 1);
      const latest = latestDateByCategory.get(transaction.categoryId);
      if (!latest || transaction.date > latest) latestDateByCategory.set(transaction.categoryId, transaction.date);
    }

    let winningCategoryId = "";
    let winningCount = -1;
    let winningDate = "";
    for (const [categoryId, count] of countByCategory) {
      const latest = latestDateByCategory.get(categoryId) ?? "";
      if (count > winningCount || (count === winningCount && latest > winningDate)) {
        winningCategoryId = categoryId;
        winningCount = count;
        winningDate = latest;
      }
    }

    const winning = group.filter((transaction) => transaction.categoryId === winningCategoryId);
    const percentages = winning.map(splitPercentageOf);
    const uniform = percentages.every((percentage) => percentage === percentages[0]);

    seeds.push({
      pattern,
      categoryId: winningCategoryId,
      splitPercentage: uniform && percentages[0] > 0 ? percentages[0] : null,
    });
  }

  return seeds;
}

/**
 * Popola le regole `appresa` di un utente a partire dal suo storico già categorizzato (categorie di
 * fallback escluse). Idempotente: le regole già presenti sullo stesso pattern non vengono duplicate.
 * Ritorna il numero di regole create.
 */
export async function backfillCategorizationRules(userId: string): Promise<number> {
  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const fallbackIds = new Set(userCategories.filter((category) => category.isFallback).map((c) => c.id));

  const history = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const categorized = history.filter((transaction) => !fallbackIds.has(transaction.categoryId));

  const seeds = buildRulesFromHistory(categorized);
  if (seeds.length === 0) return 0;

  const inserted = await db
    .insert(categorizationRules)
    .values(
      seeds.map((seed) => ({
        userId,
        matchType: "merchant" as const,
        pattern: seed.pattern,
        categoryId: seed.categoryId,
        splitPercentage: seed.splitPercentage === null ? null : seed.splitPercentage.toFixed(4),
        source: "appresa" as const,
      }))
    )
    .onConflictDoNothing({
      target: [categorizationRules.userId, categorizationRules.matchType, categorizationRules.pattern],
    })
    .returning({ id: categorizationRules.id });

  return inserted.length;
}

/** Esecuzione da riga di comando: popola le regole di tutti gli utenti e stampa il conteggio. */
async function main() {
  const users = await db.selectDistinct({ userId: transactions.userId }).from(transactions);
  let total = 0;
  for (const { userId } of users) {
    const created = await backfillCategorizationRules(userId);
    console.log(`utente ${userId}: ${created} regole create`);
    total += created;
  }
  console.log(`totale: ${total} regole create`);
  process.exit(0);
}

if (process.argv[1]?.includes("backfill-categorization-rules")) {
  void main();
}
