import type { CategoryAmount } from "@/lib/calc/expenses";
import { EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY, type CategoryGroupKey } from "@/lib/categories/groups";

const GROUP_ORDER = Object.fromEntries(
  [...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY].map((key, index) => [key, index])
) as Record<CategoryGroupKey, number>;

/** Ordina le categorie per gruppo (Dovute → Volute → Te futuro → Saltuarie → Da categorizzare) e, dentro ogni gruppo, per importo decrescente. */
export function sortCategoryAmounts(categoryAmounts: CategoryAmount[]): CategoryAmount[] {
  return [...categoryAmounts].sort((a, b) => {
    if (a.group !== b.group) return GROUP_ORDER[a.group] - GROUP_ORDER[b.group];
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

export type LegendSortCriterion = "percentuale" | "valore" | "budget" | "nome";
export type LegendSortDirection = "asc" | "desc";

export const LEGEND_SORT_DEFAULT_DIRECTION: Record<LegendSortCriterion, LegendSortDirection> = {
  percentuale: "desc",
  valore: "desc",
  budget: "desc",
  nome: "asc",
};

export interface LegendEntry extends CategoryAmount {
  budgetAmount: number;
  saturazionePct: number | null;
  quotaPct: number | null;
}

/** Confronta due valori nullable: null perde sempre (va in fondo), indipendentemente dalla direzione richiesta. */
function compareNullable(a: number | null, b: number | null, direction: LegendSortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "desc" ? b - a : a - b;
}

/**
 * Ordina le voci della legenda "Per categoria" secondo il criterio scelto dall'utente (percentuale sul totale,
 * valore speso, saturazione budget o nome). Non tocca l'ordinamento delle fette del donut (sortCategoryAmounts).
 * Valori null (budget/totale a 0) restano sempre in fondo alla lista qualunque sia la direzione.
 */
export function sortLegendEntries(
  entries: LegendEntry[],
  criterion: LegendSortCriterion,
  direction: LegendSortDirection
): LegendEntry[] {
  return [...entries].sort((a, b) => {
    switch (criterion) {
      case "percentuale":
        return compareNullable(a.quotaPct, b.quotaPct, direction);
      case "budget":
        return compareNullable(a.saturazionePct, b.saturazionePct, direction);
      case "valore":
        return direction === "desc" ? b.amount - a.amount : a.amount - b.amount;
      case "nome":
        return direction === "desc" ? b.name.localeCompare(a.name, "it") : a.name.localeCompare(b.name, "it");
    }
  });
}
