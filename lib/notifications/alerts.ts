import type { Budget } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { buildBudgetMonth, type BudgetMonthAmount } from "@/lib/calc/budget-plan";
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
  /** Budget available this month: the month's amount plus the leftover carried from the months before. */
  budget: number;
  /** Where the month is heading when that is over the budget (null otherwise, or without history). */
  projected: number | null;
  /** Tutte le chiavi di deduplica da segnare quando l'avviso parte (la soglia raggiunta e quelle sotto). */
  itemKeys: string[];
  /** Chiave della soglia raggiunta: è quella che, se già inviata, esclude l'avviso. */
  itemKey: string;
}

/** Chiave di deduplica di una soglia di budget: un avviso per categoria, mese e soglia. */
export function budgetItemKey(monthKey: string, categoryId: string, threshold: number): string {
  return `budget:${monthKey}:${categoryId}:${threshold}`;
}

/**
 * Categories that reached a budget threshold this month not yet notified. The budget is the one shown in Liquidità ·
 * Budget: the month's amount (single-month one included) plus the leftover carried when rollover is on.
 */
export function findBudgetAlerts(input: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  months?: BudgetMonthAmount[];
  alreadySent: ReadonlySet<string>;
  now: Date;
}): BudgetAlert[] {
  const { year, month } = romeDate(input.now);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const plan = buildBudgetMonth({ transactions: input.transactions, categories: input.categories, budgets: input.budgets, months: input.months ?? [], month: monthKey, today: romeReferenceDate(input.now) });
  const alerts: BudgetAlert[] = [];
  for (const row of plan.categories) {
    const limit = row.available;
    if (limit <= 0 || row.spent <= 0) continue;
    const reached = BUDGET_ALERT_THRESHOLDS.filter((t) => row.spent >= (limit * t) / 100);
    if (reached.length === 0) continue;
    const threshold = Math.max(...reached);
    const itemKey = budgetItemKey(monthKey, row.categoryId, threshold);
    if (input.alreadySent.has(itemKey)) continue;
    alerts.push({
      categoryId: row.categoryId,
      name: row.name,
      threshold,
      spent: row.spent,
      budget: limit,
      projected: row.projected !== null && row.projected > limit && row.spent <= limit ? row.projected : null,
      itemKey,
      itemKeys: reached.map((t) => budgetItemKey(monthKey, row.categoryId, t)),
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
