/** Spesa/entrata del periodo per categoria e per gruppo, per la vista "Dettaglio" della pagina Categorie. Modulo puro. */

import { categoryGroupKey, type CategoryGroupKey } from "@/lib/categories/groups";

export interface SpendTransaction {
  categoryId: string | null;
  amount: string;
  excludedAmount: string;
}

export interface SpendCategory {
  id: string;
  type: string;
  isFallback: boolean;
}

/** Totale in valore assoluto per categoria, al netto della quota esclusa ("Dividi"). Il chiamante filtra già per periodo. */
export function sumByCategory(transactions: SpendTransaction[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const transaction of transactions) {
    if (!transaction.categoryId) continue;
    const effective = Math.abs(Number(transaction.amount)) - Math.abs(Number(transaction.excludedAmount));
    totals[transaction.categoryId] = (totals[transaction.categoryId] ?? 0) + effective;
  }
  return totals;
}

/** Totale per gruppo di spesa (`daCategorizzare` incluso); le entrate non rientrano in nessun gruppo. */
export function sumByGroup(
  categories: SpendCategory[],
  totalsByCategory: Record<string, number>
): Partial<Record<CategoryGroupKey, number>> {
  const totals: Partial<Record<CategoryGroupKey, number>> = {};
  for (const category of categories) {
    const key = categoryGroupKey(category);
    if (key === null) continue;
    totals[key] = (totals[key] ?? 0) + (totalsByCategory[category.id] ?? 0);
  }
  return totals;
}
