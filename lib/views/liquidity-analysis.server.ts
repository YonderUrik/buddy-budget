import "server-only";
import { loadTransactionRows } from "@/lib/liquidity/transactions-list.server";
import { liquidityFetchWindow } from "@/lib/liquidity/fetch-window";
import { resolveProfile } from "@/lib/localization/config";
import type { ExpensePeriod } from "@/lib/calc/expenses";
import { loadUserBudgets, loadUserCategories } from "./data.server";
import { buildLiquidityAnalysis } from "./liquidity-analysis";
import type { LiquidityAnalysis } from "./schemas";

/** Loads and computes `GET /api/liquidity/analysis` for a user, on the web's transaction window. */
export async function loadLiquidityAnalysis(
  user: { id: string; currency?: string | null; productCountry?: string | null; language?: string | null },
  options: { today: Date; period: ExpensePeriod; referenceDate: Date; accountId: string | null },
): Promise<LiquidityAnalysis> {
  const profile = resolveProfile(user);
  const window = liquidityFetchWindow(options.referenceDate);
  const [transactions, categories, budgets] = await Promise.all([
    loadTransactionRows(user.id, { ...window, direction: "tutte" }),
    loadUserCategories(user.id, profile),
    loadUserBudgets(user.id),
  ]);
  return buildLiquidityAnalysis({ ...options, currency: user.currency ?? "EUR", language: profile.language, transactions, categories, budgets });
}
