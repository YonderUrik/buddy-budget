import "server-only";
import { loadBudgetMonths } from "@/lib/budgets/store.server";
import { monthKey, shiftMonth, ROLLOVER_MAX_MONTHS, daysInMonthKey } from "@/lib/calc/budget-plan";
import { loadTransactionRows } from "@/lib/liquidity/transactions-list.server";
import { resolveProfile } from "@/lib/localization/config";
import { loadUserBudgets, loadUserCategories } from "./data.server";
import { buildBudgetMonthView, type BudgetMonthView } from "./budget-month";

/**
 * Loads and computes `GET /api/budgets/month` for a user. The transaction window reaches back far enough for the
 * longest carried leftover and for the yearly proposals.
 */
export async function loadBudgetMonth(
  user: { id: string; currency?: string | null; productCountry?: string | null; language?: string | null },
  options: { today: Date; month: string },
): Promise<BudgetMonthView> {
  const profile = resolveProfile(user);
  const current = monthKey(options.today);
  const earliest = options.month < current ? options.month : current;
  const latest = options.month > current ? options.month : current;
  const window = { from: `${shiftMonth(earliest, -ROLLOVER_MAX_MONTHS)}-01`, to: `${latest}-${daysInMonthKey(latest)}` };
  const [transactions, categories, budgets, months] = await Promise.all([
    loadTransactionRows(user.id, { ...window, direction: "tutte" }),
    loadUserCategories(user.id, profile),
    loadUserBudgets(user.id),
    loadBudgetMonths(user.id),
  ]);
  return buildBudgetMonthView({ currency: user.currency ?? "EUR", month: options.month, today: options.today, transactions, categories, budgets, months });
}
