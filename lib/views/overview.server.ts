import "server-only";
import { addMonths, endOfMonth, startOfMonth } from "@/lib/calc/expenses";
import { MONTH_PACE_LOOKBACK } from "@/lib/calc/month-pace";
import { getNetWorthPeriodRange, toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import { loadUserDebts } from "@/lib/debts/data";
import { buildDebtsView } from "@/lib/debts/view";
import { loadInvestmentData } from "@/lib/investments/data";
import { isCountryPathAvailable, resolveProfile } from "@/lib/localization/config";
import { loadTransactionRows } from "@/lib/liquidity/transactions-list.server";
import { loadNetWorthSnapshotRows } from "@/lib/net-worth/snapshot-rows";
import { requestLogger } from "@/lib/observability";
import { loadUserPension } from "@/lib/pension/data";
import { loadBankConnectionStatuses, loadUserAccounts, loadUserBudgets } from "./data.server";
import { loadBudgetMonth } from "./budget-month.server";
import { monthKey } from "@/lib/calc/budget-plan";
import { buildOverviewView, OVERVIEW_INVESTMENTS_PERIOD } from "./overview";
import type { OverviewView } from "./schemas";

/** Start of the snapshot window: the whole history, as the web fetches it (compact beyond the last year). */
const NET_WORTH_FETCH_FROM = "2000-01-01";

export interface OverviewUser {
  id: string;
  currency?: string | null;
  productCountry?: string | null;
  language?: string | null;
}

/**
 * Loads what the Overview shows for a user and computes it with `buildOverviewView`. Like the web page, investments,
 * debts and pension are optional: a failure there leaves them out (logged), it does not fail the whole view.
 */
export async function loadOverviewView(user: OverviewUser, options: { today: Date; period: NetWorthPeriod; includePension: boolean }): Promise<OverviewView> {
  const { today } = options;
  const profile = resolveProfile(user);
  const monthFrom = addMonths(startOfMonth(today), -MONTH_PACE_LOOKBACK);
  const pricesFrom = toDateKey(getNetWorthPeriodRange(OVERVIEW_INVESTMENTS_PERIOD, today, null).from);
  const pensionAvailable = isCountryPathAvailable(profile.productCountry, "/api/pension");
  const log = requestLogger();
  const optional = <T>(part: string, promise: Promise<T>): Promise<T | null> =>
    promise.catch((error: unknown) => {
      log.warn("overview.view.partial", { phase: part, error });
      return null;
    });

  const [accounts, snapshots, monthTransactions, budgets, investments, debts, pension, connections] = await Promise.all([
    loadUserAccounts(user.id),
    loadNetWorthSnapshotRows(user.id, NET_WORTH_FETCH_FROM, toDateKey(today), { compact: true }),
    loadTransactionRows(user.id, { from: toDateKey(monthFrom), to: toDateKey(endOfMonth(today)), direction: "tutte" }),
    loadUserBudgets(user.id),
    // The browser computes on the JSON of /api/investments/overview: the same round trip keeps the engine's input identical.
    optional("investments", loadInvestmentData(user.id, pricesFrom).then((data) => JSON.parse(JSON.stringify(data)) as typeof data)),
    optional("debts", loadUserDebts(user.id).then(({ debts: rows, events }) => buildDebtsView(rows, events, toDateKey(today)))),
    pensionAvailable ? optional("pension", loadUserPension(user.id)) : Promise.resolve(null),
    optional("connections", loadBankConnectionStatuses(user.id, new Date())),
  ]);

  // With budgets, «Budget» reads the same month as Liquidità · Budget; a failure there falls back to the standing amounts.
  const budgetMonth = budgets.length > 0 ? await optional("budgets", loadBudgetMonth(user, { today, month: monthKey(today) })) : null;

  return buildOverviewView({
    today,
    period: options.period,
    includePension: options.includePension,
    currency: user.currency ?? "EUR",
    language: profile.language,
    accounts,
    snapshots,
    monthTransactions,
    budgets,
    budgetTotals: budgetMonth && budgetMonth.categories.length > 0 ? { available: budgetMonth.total.available, spent: budgetMonth.total.spent } : null,
    investments,
    debts,
    pensionFunds: pension?.funds ?? [],
    connections: connections ?? [],
  });
}
