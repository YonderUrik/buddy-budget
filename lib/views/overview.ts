/**
 * Overview (Panoramica) computed on the server: the same functions `app/(app)/panoramica/page.tsx` runs in the
 * browser, fed with the same data its queries fetch. Pure: the loader is `overview.server.ts`.
 */
import { computeAccountsKpi } from "@/components/domain/accounts/accounts-kpi.utils";
import { buildRenewalAlerts, describeRenewalAlert, type RenewalSource } from "@/components/domain/accounts/renewal-alerts";
import { buildCompositionItems } from "@/components/domain/net-worth/net-worth-composition-row.utils";
import { computeMonthPace } from "@/lib/calc/month-pace";
import {
  buildNetWorthSeries,
  computeNetWorthChange,
  excludeClassFromSeries,
  toDateKey,
  type NetWorthByClass,
  type NetWorthPeriod,
  type NetWorthSnapshotInput,
} from "@/lib/calc/net-worth";
import type { Account } from "@/lib/db/schema/accounts";
import type { Budget } from "@/lib/db/schema/budgets";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { DebtsViewData } from "@/lib/debts/view";
import { computeValueBreakdown } from "@/lib/investments/insights";
import { buildInvestmentsView } from "@/lib/investments/view";
import type { InvestmentData } from "@/lib/investments/data";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import { pensionTotalOn } from "@/lib/net-worth/pension-history";
import { buildVoiceLines } from "@/lib/overview/voice";
import type { PensionFundData } from "@/lib/pension/types";
import type { OverviewView } from "./schemas";

/** Period of the investments data the Overview needs: today's value only needs the last month of prices. */
export const OVERVIEW_INVESTMENTS_PERIOD: NetWorthPeriod = "1mese";
/** Default chart period, as on the web. */
export const OVERVIEW_DEFAULT_PERIOD: NetWorthPeriod = "3mesi";

export interface OverviewInputs {
  today: Date;
  period: NetWorthPeriod;
  includePension: boolean;
  currency: string;
  language: Language;
  accounts: Account[];
  snapshots: NetWorthSnapshotInput[];
  /** Transactions from MONTH_PACE_LOOKBACK months before this month to its end (as the web fetches them). */
  monthTransactions: Transaction[];
  budgets: Budget[];
  /** `GET /api/investments/overview?period=1mese` payload, as the browser receives it (JSON); null on error. */
  investments: InvestmentData | null;
  debts: DebtsViewData | null;
  /** Pension funds with snapshots; empty where the country has no pension section. */
  pensionFunds: PensionFundData[];
  connections: RenewalSource[];
}

/** Builds the Overview view from loaded data. */
export function buildOverviewView(input: OverviewInputs): OverviewView {
  const { today, period, language } = input;
  const locale = LANGUAGE_LOCALES[language];
  const tr = (source: string) => translate(language, source);
  const todayKey = toDateKey(today);

  const { totalLiquidity } = computeAccountsKpi(input.accounts);
  let investments: OverviewView["investments"] = null;
  if (input.investments && input.investments.transactions.length > 0) {
    const { summary } = buildInvestmentsView(input.investments, OVERVIEW_INVESTMENTS_PERIOD, today, undefined, locale);
    const { paid, market } = computeValueBreakdown(summary);
    investments = { value: summary.totalValue, positions: summary.rows.length, paid, marketGain: market };
  }
  const debtsData = input.debts?.overview;
  const debts = debtsData && debtsData.totalDebt > 0 ? { total: debtsData.totalDebt, count: debtsData.openCount } : null;
  const pensionValue = pensionTotalOn(input.pensionFunds, todayKey);
  const pension = pensionValue > 0 ? { value: pensionValue, funds: input.pensionFunds.filter((f) => f.snapshots.length > 0).length } : null;

  const todayByClass: NetWorthByClass = {
    liquidita: totalLiquidity,
    ...(investments ? { investimenti: investments.value } : {}),
    ...(pension ? { previdenza: pension.value } : {}),
    ...(debts ? { debiti: -debts.total } : {}),
  };
  const fullSeries = buildNetWorthSeries(input.snapshots, todayByClass, period, today, locale);
  const series = input.includePension ? fullSeries : excludeClassFromSeries(fullSeries, "previdenza");
  const change = computeNetWorthChange(series);
  const composition = buildCompositionItems(input.accounts, investments, debts, pension ? { ...pension, excluded: !input.includePension } : null, language);
  const pace = computeMonthPace(input.monthTransactions, input.budgets, today);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long" }).format(today);
  const dues = debtsData?.nextDue ?? [];
  const voice = buildVoiceLines({
    language,
    pace,
    monthLabel,
    currency: input.currency,
    nextDue: dues[0] ? { name: dues[0].name, date: dues[0].date, amount: dues[0].amount } : null,
    today,
  });

  return {
    currency: input.currency,
    today: todayKey,
    period,
    includePension: input.includePension,
    isEmpty: input.accounts.length === 0 && !investments && !pension,
    todayByClass,
    series: series.map(({ date, value, byClass, isEstimated }) => ({ date, value, byClass, isEstimated })),
    change,
    composition: composition.map((item) => ({
      key: item.key,
      label: tr(item.label),
      detail: item.detail,
      amount: item.amount,
      share: item.share,
      isLiability: item.isLiability ?? false,
      highlight: item.highlight ? { ...item.highlight, label: tr(item.highlight.label) } : null,
    })),
    monthLabel,
    monthPace: pace,
    voice,
    investments,
    pension: pension ? { ...pension, included: input.includePension } : null,
    debts: debtsData && debts ? { ...debts, debtFreeDate: debtsData.debtFreeDate, nextDue: dues } : null,
    renewalAlerts: buildRenewalAlerts(input.connections, today).map((alert) => ({ ...alert, message: describeRenewalAlert(alert, language) })),
  };
}
