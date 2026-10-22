import type { Budget, BudgetMonth } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { budgetAmountFor, buildBudgetMonth, indexSpending, monthKey, proposeBudgets, shiftMonth, spentIn } from "@/lib/calc/budget-plan";
import { categoryGroupKey } from "@/lib/categories/groups";
import { toDateKey } from "@/lib/calc/net-worth";

/** Inputs of `GET /api/budgets/month`. */
export interface BudgetMonthViewInput {
  currency: string;
  month: string;
  today: Date;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  months: BudgetMonth[];
}

/**
 * Liquidità · Budget for one month: the plan (each budgeted category with its carried leftover and where it is
 * heading, totals, income) and, for the current month, the budgets the app proposes for the categories without one.
 */
export function buildBudgetMonthView(input: BudgetMonthViewInput) {
  const plan = buildBudgetMonth({ ...input, month: input.month });
  const byId = new Map(input.categories.map((c) => [c.id, c]));
  const proposals = input.month === monthKey(input.today)
    ? proposeBudgets(input).flatMap((p) => {
        const category = byId.get(p.categoryId);
        const group = category ? categoryGroupKey(category) : null;
        return category && group ? [{ ...p, name: category.name, group, color: category.color, icon: category.icon }] : [];
      })
    : [];
  // Each category also carries its standing amount and its three months before, for the budget's own sheet.
  const spending = indexSpending(input.transactions);
  const budgetById = new Map(input.budgets.map((b) => [b.categoryId, b]));
  const categories = plan.categories.map((status) => {
    const budget = budgetById.get(status.categoryId)!;
    const history = [1, 2, 3].map((back) => {
      const month = shiftMonth(input.month, -back);
      const amount = budgetAmountFor(budget, input.months, month).amount;
      const spent = spentIn(spending, status.categoryId, month);
      const counted = budget.rollover && budget.rolloverFrom !== null && budget.rolloverFrom <= month;
      return { month, amount, spent, carriedOut: counted ? Math.round((amount - spent) * 100) / 100 : null };
    });
    return { ...status, monthlyAmount: Number(budget.monthlyAmount), rolloverFrom: budget.rolloverFrom, history };
  });
  return { currency: input.currency, today: toDateKey(input.today), ...plan, categories, proposals };
}

export type BudgetMonthView = ReturnType<typeof buildBudgetMonthView>;
