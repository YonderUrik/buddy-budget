import type { Budget } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { computeCategoryBreakdown } from "@/lib/calc/expenses";
import { addDaysIso } from "@/lib/debts/dates";
import type { DebtDueItem } from "@/lib/debts/view";
import { BUDGET_ALERT_THRESHOLDS, DEADLINE_LEAD_DAYS } from "./constants";
import { romeDate, romeReferenceDate } from "./dates";

export interface BudgetAlert {
  categoryId: string;
  name: string;
  /** Soglia più alta raggiunta (80 o 100). */
  threshold: number;
  spent: number;
  budget: number;
  /** Tutte le chiavi di deduplica da segnare quando l'avviso parte (la soglia raggiunta e quelle sotto). */
  itemKeys: string[];
  /** Chiave della soglia raggiunta: è quella che, se già inviata, esclude l'avviso. */
  itemKey: string;
}

/** Chiave di deduplica di una soglia di budget: un avviso per categoria, mese e soglia. */
export function budgetItemKey(monthKey: string, categoryId: string, threshold: number): string {
  return `budget:${monthKey}:${categoryId}:${threshold}`;
}

/** Categorie che nel mese in corso hanno raggiunto una soglia di budget non ancora segnalata. */
export function findBudgetAlerts(input: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  alreadySent: ReadonlySet<string>;
  now: Date;
}): BudgetAlert[] {
  const { year, month } = romeDate(input.now);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const reference = romeReferenceDate(input.now);
  const amounts = new Map(computeCategoryBreakdown(input.transactions, input.categories, "mese", reference, reference).map((c) => [c.categoryId, c]));
  const alerts: BudgetAlert[] = [];
  for (const budget of input.budgets) {
    const limit = Number(budget.monthlyAmount);
    const row = amounts.get(budget.categoryId);
    if (!row || limit <= 0) continue;
    const reached = BUDGET_ALERT_THRESHOLDS.filter((t) => row.amount >= (limit * t) / 100);
    if (reached.length === 0) continue;
    const threshold = Math.max(...reached);
    const itemKey = budgetItemKey(monthKey, budget.categoryId, threshold);
    if (input.alreadySent.has(itemKey)) continue;
    alerts.push({
      categoryId: budget.categoryId,
      name: row.name,
      threshold,
      spent: row.amount,
      budget: limit,
      itemKey,
      itemKeys: reached.map((t) => budgetItemKey(monthKey, budget.categoryId, t)),
    });
  }
  return alerts.sort((a, b) => b.threshold - a.threshold || b.spent / b.budget - a.spent / a.budget);
}

export interface DeadlineAlert extends DebtDueItem {
  itemKey: string;
}

/** Rate in scadenza entro `DEADLINE_LEAD_DAYS` giorni (o già scadute) non ancora segnalate. */
export function findDeadlineAlerts(input: { due: DebtDueItem[]; alreadySent: ReadonlySet<string>; now: Date }): DeadlineAlert[] {
  const limit = addDaysIso(romeDate(input.now).iso, DEADLINE_LEAD_DAYS);
  return input.due
    .filter((d) => d.date <= limit)
    .map((d) => ({ ...d, itemKey: `rata:${d.debtId}:${d.date}` }))
    .filter((d) => !input.alreadySent.has(d.itemKey))
    .sort((a, b) => a.date.localeCompare(b.date));
}
