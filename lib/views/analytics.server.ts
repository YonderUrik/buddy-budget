import "server-only";
import { toDateKey } from "@/lib/calc/net-worth";
import { loadAssumptions } from "@/lib/analitiche/data";
import { analyticsTransactionsRange } from "@/lib/analitiche/base";
import type { NetWorthSnapshot } from "@/lib/db/schema/net-worth-snapshots";
import { loadUserDebts } from "@/lib/debts/data";
import { todayIso } from "@/lib/debts/dates";
import { buildDebtsView } from "@/lib/debts/view";
import { loadInvestmentData, type InvestmentData } from "@/lib/investments/data";
import { loadTransactionRows } from "@/lib/liquidity/transactions-list.server";
import { countryFeatures, resolveProfile } from "@/lib/localization/config";
import { loadNetWorthSnapshotRows } from "@/lib/net-worth/snapshot-rows";
import { loadUserPension } from "@/lib/pension/data";
import { buildAnalyticsView } from "./analytics";
import { loadUserAccounts, loadUserCategories } from "./data.server";

/** Earliest net-worth snapshot the web asks for. */
const SNAPSHOTS_FROM = "2000-01-01";

/**
 * Loads what `AnalyticsProvider` fetches (accounts, assumptions, transactions of the data period, localized categories,
 * investments `max`, pension, debts total, net-worth snapshots) and computes `GET /api/analytics/base`. Investments and
 * snapshots go through JSON like on the web, so the engine sees the same values.
 */
export async function loadAnalyticsView(user: { id: string; currency?: string | null; productCountry?: string | null; language?: string | null }, options: { today: Date }) {
  const profile = resolveProfile(user);
  const { assumptions, walkthroughSeen } = await loadAssumptions(user.id);
  const range = analyticsTransactionsRange(assumptions.dataPeriod, options.today);
  const [accounts, transactions, categories, investments, pension, debts, snapshots] = await Promise.all([
    loadUserAccounts(user.id),
    loadTransactionRows(user.id, { ...range, direction: "tutte" }),
    loadUserCategories(user.id, profile),
    loadInvestmentData(user.id, null).then((data) => JSON.parse(JSON.stringify(data)) as InvestmentData),
    loadUserPension(user.id),
    loadUserDebts(user.id).then(({ debts: rows, events }) => buildDebtsView(rows, events, todayIso())),
    loadNetWorthSnapshotRows(user.id, SNAPSHOTS_FROM, toDateKey(options.today)).then((rows) => JSON.parse(JSON.stringify(rows)) as NetWorthSnapshot[]),
  ]);
  return buildAnalyticsView({
    today: options.today,
    currency: user.currency ?? "EUR",
    language: profile.language,
    accounts,
    transactions,
    categories,
    investments,
    pensionFunds: pension.funds,
    debtsTotal: debts.overview.totalDebt,
    snapshots,
    // Before tax where the country has no capital gains rules (Germany, «Altro paese»), as on the web.
    capitalGainsTax: countryFeatures(profile.productCountry).taxes,
    stored: assumptions,
    walkthroughSeen,
  });
}
