import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { categoryGroupKey } from "@/lib/categories/groups";
import type { CategoryGroupKey } from "@/lib/categories/groups";

/**
 * Monthly budget plan: what each budgeted category has this month (its amount, plus the leftover carried from the
 * months before when rollover is on), what it spent, where it is heading, and the budgets the app proposes from the
 * user's own history. Pure: no database, no React. Months are `YYYY-MM` keys in the caller's calendar.
 */

/** Months whose leftover can be carried at most: an old forgotten rollover does not pile up forever. */
export const ROLLOVER_MAX_MONTHS = 24;
/** Complete months used to propose a budget for a monthly group (median). */
export const PROPOSAL_MONTHS = 3;
/** Complete months used to propose a budget for an occasional group (total / months). */
export const PROPOSAL_YEARLY_MONTHS = 12;
/** Complete months used to estimate the usual income and the rest-of-month spending. */
export const USUAL_MONTHS = 3;

/** Budget settings as stored (`budgets` row), reduced to what the plan needs. */
export interface BudgetSetting {
  categoryId: string;
  monthlyAmount: number | string;
  rollover: boolean;
  rolloverFrom: string | null;
}

/** One month amount of a budget (`budget_months` row). */
export interface BudgetMonthAmount {
  categoryId: string;
  month: string;
  amount: number | string;
  singleMonth: boolean;
}

/** `YYYY-MM` of a date, in local time. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Moves a `YYYY-MM` key by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  return monthKey(new Date(year, m - 1 + delta, 1));
}

/** Number of days of a `YYYY-MM` month. */
export function daysInMonthKey(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m, 0).getDate();
}

/** True for a well-formed `YYYY-MM` key. */
export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Effective spending of one expense transaction (after «Dividi»), positive. */
function spentOf(transaction: Transaction): number {
  return Math.abs(Number(transaction.amount)) - Math.abs(Number(transaction.excludedAmount));
}

/** Expense amounts by category, month and day: `categoryId → month → day[]` (index 0 = day 1). */
export type SpendingIndex = Map<string, Map<string, number[]>>;

/** Indexes expense transactions by category, month and day, so every later lookup is a map read. */
export function indexSpending(transactions: Transaction[]): SpendingIndex {
  const index: SpendingIndex = new Map();
  for (const t of transactions) {
    if (Number(t.amount) >= 0 || !t.categoryId) continue;
    const month = t.date.slice(0, 7);
    const day = Number(t.date.slice(8, 10));
    let byMonth = index.get(t.categoryId);
    if (!byMonth) index.set(t.categoryId, (byMonth = new Map()));
    let days = byMonth.get(month);
    if (!days) byMonth.set(month, (days = new Array<number>(31).fill(0)));
    days[day - 1] += spentOf(t);
  }
  return index;
}

/** Spending of a category in a month, optionally only from day `fromDay` (1-based, inclusive) or up to `toDay`. */
export function spentIn(index: SpendingIndex, categoryId: string, month: string, range: { fromDay?: number; toDay?: number } = {}): number {
  const days = index.get(categoryId)?.get(month);
  if (!days) return 0;
  const from = (range.fromDay ?? 1) - 1;
  const to = range.toDay ?? 31;
  let total = 0;
  for (let i = from; i < to; i += 1) total += days[i];
  return total;
}

/**
 * Amount of a budget in a month: the single-month amount if there is one, otherwise the latest standing amount set
 * on or before that month (the earliest one for months before the first change, the current amount without history).
 */
export function budgetAmountFor(budget: BudgetSetting, months: BudgetMonthAmount[], month: string): { amount: number; singleMonth: boolean } {
  const own = months.filter((m) => m.categoryId === budget.categoryId);
  const single = own.find((m) => m.singleMonth && m.month === month);
  if (single) return { amount: Number(single.amount), singleMonth: true };
  const standing = own.filter((m) => !m.singleMonth).sort((a, b) => a.month.localeCompare(b.month));
  if (standing.length === 0) return { amount: Number(budget.monthlyAmount), singleMonth: false };
  const before = standing.filter((m) => m.month <= month);
  const row = before.length > 0 ? before[before.length - 1] : standing[0];
  return { amount: Number(row.amount), singleMonth: false };
}

/**
 * Leftover carried into `month`: the sum of (amount − spent) of every month from `rolloverFrom` (at most
 * `ROLLOVER_MAX_MONTHS` back) to the month before. Negative when past overspending ate into this month. 0 without rollover.
 */
export function carriedInto(budget: BudgetSetting, months: BudgetMonthAmount[], spending: SpendingIndex, month: string): number {
  if (!budget.rollover || !budget.rolloverFrom || budget.rolloverFrom >= month) return 0;
  const oldest = shiftMonth(month, -ROLLOVER_MAX_MONTHS);
  let cursor = budget.rolloverFrom > oldest ? budget.rolloverFrom : oldest;
  let carried = 0;
  while (cursor < month) {
    carried += budgetAmountFor(budget, months, cursor).amount - spentIn(spending, budget.categoryId, cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return Math.round(carried * 100) / 100;
}

export interface CategoryBudgetStatus {
  categoryId: string;
  name: string;
  group: CategoryGroupKey;
  color: string;
  icon: string;
  /** Budget of the month (the single-month amount when set). */
  amount: number;
  singleMonth: boolean;
  rollover: boolean;
  /** Leftover carried from the months before (negative = past overspending). */
  carried: number;
  /** amount + carried, never below 0. */
  available: number;
  spent: number;
  /** available − spent (negative = over). */
  left: number;
  /**
   * Where the month is heading: spent so far plus what the category usually spends in the rest of the month (current
   * month only, monthly groups only, null without history). A rent paid on the 1st does not inflate it.
   */
  projected: number | null;
}

export interface UnbudgetedCategory {
  categoryId: string;
  name: string;
  group: CategoryGroupKey;
  color: string;
  icon: string;
  spent: number;
}

export interface BudgetMonthPlan {
  month: string;
  /** `current`, `past` or `future` relative to `today`. */
  when: "past" | "current" | "future";
  daysInMonth: number;
  /** Day of the month today (current month only). */
  dayOfMonth: number | null;
  /** Days from today to the end of the month, today included (current month only). */
  daysLeft: number | null;
  /** Share of the month gone by: where spending «should» be today (current month only). */
  expectedShare: number | null;
  categories: CategoryBudgetStatus[];
  unbudgeted: UnbudgetedCategory[];
  total: {
    available: number;
    spent: number;
    left: number;
    /** What can still be spent per day to stay within the budgets (current month, only while something is left). */
    perDay: number | null;
  };
  /** Income of the month: the usual one (average of the complete months before) for the current and future months, the real one for a past month. */
  income: { amount: number; kind: "usual" | "actual" } | null;
}

/** Income of a month (positive transactions, effective amount) excluding transfer categories. */
function incomeOf(transactions: Transaction[], categories: Category[], month: string): number {
  const transfers = new Set(categories.filter((c) => c.type === "trasferimento").map((c) => c.id));
  let total = 0;
  for (const t of transactions) {
    if (Number(t.amount) <= 0 || !t.date.startsWith(month)) continue;
    if (t.categoryId && transfers.has(t.categoryId)) continue;
    total += Number(t.amount) - Number(t.excludedAmount);
  }
  return total;
}

/** Months with at least one transaction: a month before the user's first import is not a month of «0 €». */
function monthsWithData(transactions: Transaction[]): Set<string> {
  return new Set(transactions.map((t) => t.date.slice(0, 7)));
}

/** Builds the plan of one month for the budget view, Panoramica and the alert emails. */
export function buildBudgetMonth(input: {
  transactions: Transaction[];
  categories: Category[];
  budgets: BudgetSetting[];
  months: BudgetMonthAmount[];
  month: string;
  today: Date;
}): BudgetMonthPlan {
  const { transactions, categories, budgets, months, month, today } = input;
  const current = monthKey(today);
  const when = month < current ? "past" : month > current ? "future" : "current";
  const daysInMonth = daysInMonthKey(month);
  const dayOfMonth = when === "current" ? today.getDate() : null;
  const spending = indexSpending(transactions);
  const withData = monthsWithData(transactions);
  const history = Array.from({ length: USUAL_MONTHS }, (_, i) => shiftMonth(current, -(i + 1))).filter((m) => withData.has(m));

  const byId = new Map(categories.map((c) => [c.id, c]));
  const budgeted = new Set<string>();
  const statuses: CategoryBudgetStatus[] = [];
  for (const budget of budgets) {
    const category = byId.get(budget.categoryId);
    const group = category ? categoryGroupKey(category) : null;
    if (!category || group === null) continue;
    budgeted.add(category.id);
    const { amount, singleMonth } = budgetAmountFor(budget, months, month);
    const carried = carriedInto(budget, months, spending, month);
    const available = Math.max(0, amount + carried);
    const spent = spentIn(spending, category.id, month);
    let projected: number | null = null;
    if (when === "current" && dayOfMonth !== null && group !== "saltuaria" && history.length > 0) {
      const usualRest = history.reduce((sum, m) => sum + spentIn(spending, category.id, m, { fromDay: dayOfMonth + 1 }), 0) / history.length;
      projected = Math.round((spent + usualRest) * 100) / 100;
    }
    statuses.push({
      categoryId: category.id,
      name: category.name,
      group,
      color: category.color,
      icon: category.icon,
      amount,
      singleMonth,
      rollover: budget.rollover,
      carried,
      available,
      spent,
      left: Math.round((available - spent) * 100) / 100,
      projected,
    });
  }

  const unbudgeted: UnbudgetedCategory[] = categories.flatMap((category) => {
    const group = categoryGroupKey(category);
    // «Da categorizzare» is not a budget: its spending belongs to the categories it will get.
    if (group === null || category.isFallback || budgeted.has(category.id)) return [];
    const spent = spentIn(spending, category.id, month);
    return spent > 0 ? [{ categoryId: category.id, name: category.name, group, color: category.color, icon: category.icon, spent }] : [];
  });

  const available = statuses.reduce((sum, s) => sum + s.available, 0);
  const spent = statuses.reduce((sum, s) => sum + s.spent, 0);
  const left = Math.round((available - spent) * 100) / 100;
  const daysLeft = dayOfMonth !== null ? daysInMonth - dayOfMonth + 1 : null;

  let income: BudgetMonthPlan["income"] = null;
  if (when === "past") {
    income = withData.has(month) ? { amount: incomeOf(transactions, categories, month), kind: "actual" } : null;
  } else if (history.length > 0) {
    const usual = history.reduce((sum, m) => sum + incomeOf(transactions, categories, m), 0) / history.length;
    const soFar = when === "current" ? incomeOf(transactions, categories, month) : 0;
    income = { amount: Math.round(Math.max(usual, soFar)), kind: "usual" };
  }

  return {
    month,
    when,
    daysInMonth,
    dayOfMonth,
    daysLeft,
    expectedShare: dayOfMonth !== null ? dayOfMonth / daysInMonth : null,
    categories: statuses,
    unbudgeted: unbudgeted.sort((a, b) => b.spent - a.spent),
    total: { available, spent, left, perDay: daysLeft !== null && left > 0 && statuses.length > 0 ? left / daysLeft : null },
    income,
  };
}

export interface BudgetProposal {
  categoryId: string;
  amount: number;
  /** Proposed rollover: on for occasional expenses, which are saved up month by month. */
  rollover: boolean;
  /** What the proposal comes from: the usual month (median) or the total of the last year. */
  basis: { kind: "monthly"; usual: number } | { kind: "yearly"; total: number; months: number };
}

/** Rounds a proposal up to a round figure: 5 € under 50 €, 10 € above. */
export function roundProposal(value: number): number {
  const step = value < 50 ? 5 : 10;
  return Math.ceil(value / step) * step;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Budgets the app proposes for the expense categories that have none, from the complete months before `today`:
 * the median month for Dovute and Volute, a twelfth of the last year for Saltuarie (with rollover on). «Te futuro» is
 * savings, not a ceiling, and the fallback category is not a budget: neither gets a proposal. Empty without a
 * complete month of data.
 */
export function proposeBudgets(input: { transactions: Transaction[]; categories: Category[]; budgets: Pick<BudgetSetting, "categoryId">[]; today: Date }): BudgetProposal[] {
  const current = monthKey(input.today);
  const withData = monthsWithData(input.transactions);
  const recent = Array.from({ length: PROPOSAL_MONTHS }, (_, i) => shiftMonth(current, -(i + 1))).filter((m) => withData.has(m));
  const year = Array.from({ length: PROPOSAL_YEARLY_MONTHS }, (_, i) => shiftMonth(current, -(i + 1))).filter((m) => withData.has(m));
  if (recent.length === 0) return [];
  const spending = indexSpending(input.transactions);
  const has = new Set(input.budgets.map((b) => b.categoryId));
  const proposals: BudgetProposal[] = [];
  for (const category of input.categories) {
    if (has.has(category.id) || category.isFallback) continue;
    if (category.type === "dovuta" || category.type === "voluta") {
      const usual = median(recent.map((m) => spentIn(spending, category.id, m)));
      if (usual <= 0) continue;
      proposals.push({ categoryId: category.id, amount: roundProposal(usual), rollover: false, basis: { kind: "monthly", usual: Math.round(usual) } });
    } else if (category.type === "saltuaria") {
      const total = year.reduce((sum, m) => sum + spentIn(spending, category.id, m), 0);
      if (total <= 0) continue;
      proposals.push({ categoryId: category.id, amount: roundProposal(total / year.length), rollover: true, basis: { kind: "yearly", total: Math.round(total), months: year.length } });
    }
  }
  return proposals;
}

/** Rollover proposed when a budget is created by hand: on for occasional expenses only. */
export function defaultRollover(category: Pick<Category, "type">): boolean {
  return category.type === "saltuaria";
}
