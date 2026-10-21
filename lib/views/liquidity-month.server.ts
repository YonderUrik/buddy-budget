import "server-only";
import { addMonths, endOfMonth, startOfMonth } from "@/lib/calc/expenses";
import { MONTH_PACE_LOOKBACK } from "@/lib/calc/month-pace";
import { toDateKey } from "@/lib/calc/net-worth";
import { computeAttentionSummary } from "@/lib/attention/summary";
import { loadTransactionRows } from "@/lib/liquidity/transactions-list.server";
import { resolveProfile } from "@/lib/localization/config";
import { loadUserAccounts, loadUserBudgets, loadUserCategories } from "./data.server";
import { buildLiquidityMonth } from "./liquidity-month";
import type { LiquidityMonth } from "./schemas";

/** Loads and computes `GET /api/liquidity/month` for a user. */
export async function loadLiquidityMonth(
  user: { id: string; currency?: string | null; productCountry?: string | null; language?: string | null },
  options: { today: Date; accountId: string | null },
): Promise<LiquidityMonth> {
  const profile = resolveProfile(user);
  const from = addMonths(startOfMonth(options.today), -MONTH_PACE_LOOKBACK);
  const [accounts, transactions, categories, budgets, attention] = await Promise.all([
    loadUserAccounts(user.id),
    loadTransactionRows(user.id, { from: toDateKey(from), to: toDateKey(endOfMonth(options.today)), direction: "tutte" }),
    loadUserCategories(user.id, profile),
    loadUserBudgets(user.id),
    computeAttentionSummary(user.id),
  ]);
  return buildLiquidityMonth({
    today: options.today,
    accountId: options.accountId,
    currency: user.currency ?? "EUR",
    language: profile.language,
    accounts,
    transactions,
    categories,
    budgets,
    toFix: attention.uncategorizedCount,
  });
}
