import type { CategoryAmount } from "@/lib/calc/expenses";

const TYPE_ORDER: Record<CategoryAmount["type"], number> = { fissa: 0, variabile: 1 };

/** Ordina le categorie per tipo (fissa prima di variabile) e, dentro ogni gruppo, per importo speso decrescente. */
export function sortCategoryAmounts(categoryAmounts: CategoryAmount[]): CategoryAmount[] {
  return [...categoryAmounts].sort((a, b) => {
    if (a.type !== b.type) return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    return b.amount - a.amount;
  });
}

export interface BudgetStats {
  /** Percentuale di saturazione del budget (speso / budget * 100). null se il budget è 0 (non calcolabile). */
  saturazionePct: number | null;
  /** Percentuale sul totale speso nel periodo (speso / totale * 100). null se il totale è 0 (non calcolabile). */
  quotaPct: number | null;
}

/** Calcola le percentuali di saturazione budget e quota sul totale speso per una categoria. */
export function computeBudgetStats(amount: number, budgetAmount: number, totalSpeso: number): BudgetStats {
  return {
    saturazionePct: budgetAmount > 0 ? (amount / budgetAmount) * 100 : null,
    quotaPct: totalSpeso > 0 ? (amount / totalSpeso) * 100 : null,
  };
}
