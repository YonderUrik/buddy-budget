/**
 * Investimenti computed on the server (gaps.md G7, G7b): `buildInvestmentsView`, the engine the Portafoglio,
 * Performance, Diversificazione and Operazioni tabs run in the browser, plus what their cards derive from it (value
 * breakdown, concentration, the four «reinvest costs/taxes» scenarios, price notes, exposure and correlation reading,
 * operation totals, heatmaps, risk reading and the per-point «inspect» values of the returns chart). Maps are turned
 * into arrays, the price index and the per-day cost additions stay on the server. Pure: the loader is
 * `investments-data.server.ts`.
 */
import { localizedPositionFormats } from "@/components/domain/investments/positions-format";
import { buildFxTable } from "@/lib/calc/fx";
import { toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import type { HeatmapGrouping } from "@/lib/calc/return-heatmap";
import { computePortfolioReturns, daysBetween, type PortfolioReturns } from "@/lib/calc/returns";
import { roundedCurrentWeights } from "@/lib/investments/allocation";
import { investmentBrokerGroups } from "@/lib/investments/broker-filter";
import { portfolioChartRange, type PortfolioChartPeriod, type PortfolioChartRange } from "@/lib/investments/chart-period";
import { reinvestmentEffects, simulateCostExclusions } from "@/lib/investments/cost-impact";
import type { InvestmentData } from "@/lib/investments/data";
import { areaInsight, sectorInsight } from "@/lib/investments/exposure";
import { computeConcentration, computeCurrencyExposure, computeValueBreakdown } from "@/lib/investments/insights";
import { operationYears, sumOperationTotals } from "@/lib/investments/operations-history";
import { correlationFamilies, correlationPairs } from "@/lib/investments/plain-labels";
import { heatmapFromDaily } from "@/lib/investments/return-heatmap-view";
import { localizedReturnInsights } from "@/lib/investments/returns-insights";
import { localizedRiskInsights } from "@/lib/investments/risk-insights";
import { buildInvestmentsView, toTransactionInputs, type InvestmentsView } from "@/lib/investments/view";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";

/** Chart periods of the Portafoglio and Performance selectors. */
export const PORTFOLIO_CHART_PERIODS: readonly PortfolioChartPeriod[] = ["1mese", "3mesi", "1anno", "max", "ytd", "custom"];
/** Default of the Portafoglio selector (`INVESTMENTS_DEFAULT_PERIOD` on the web) and of Performance. */
export const INVESTMENTS_VIEW_DEFAULT_PERIOD: PortfolioChartPeriod = "3mesi";
/** Heatmap groupings, all computed so the app switches without a call. */
export const HEATMAP_GROUPINGS: readonly HeatmapGrouping[] = ["giorno", "settimana", "mese", "anno"];
/**
 * Most «inspect» points computed for the returns chart. Each is a full `computePortfolioReturns(asOf)` run, so a long
 * daily series is sampled evenly (always keeping the last point); the app snaps the pointer to the nearest one.
 */
export const INSPECT_MAX_POINTS = 160;

export interface InvestmentsViewInputs {
  today: Date;
  period: PortfolioChartPeriod;
  /** Bounds for `custom` (ignored otherwise; an invalid range falls back to the period's own window, as on the web). */
  customRange: PortfolioChartRange | null;
  language: Language;
  /** All the user's investment data (for the broker list). */
  all: InvestmentData;
  /** The same data with the excluded brokers filtered out. */
  data: InvestmentData;
  excludedBrokers: ReadonlySet<string>;
}

interface ResolvedPeriod {
  period: PortfolioChartPeriod;
  calculationPeriod: NetWorthPeriod;
  range: PortfolioChartRange | undefined;
}

/** `ytd` and `custom` compute on `max` within explicit bounds, presets on their own window (as the web pages do). */
function resolvePeriod(period: PortfolioChartPeriod, customRange: PortfolioChartRange | null, todayKey: string): ResolvedPeriod {
  const custom = customRange ?? { from: `${todayKey.slice(0, 4)}-01-01`, to: todayKey };
  return { period, calculationPeriod: period === "ytd" || period === "custom" ? "max" : period, range: portfolioChartRange(period, custom, todayKey) };
}

function compute(input: InvestmentsViewInputs, range: PortfolioChartRange | undefined, calculationPeriod: NetWorthPeriod): InvestmentsView {
  return buildInvestmentsView(input.data, calculationPeriod, input.today, range, LANGUAGE_LOCALES[input.language]);
}

/** Portafoglio, Diversificazione and Operazioni: `GET /api/investments/view`. */
export function buildInvestmentsViewData(input: InvestmentsViewInputs) {
  const todayKey = toDateKey(input.today);
  const resolved = resolvePeriod(input.period, input.customRange, todayKey);
  const view = compute(input, resolved.range, resolved.calculationPeriod);
  const { instrumentsById, priceIndex, usedInstruments, costImpact, analysis, ...rest } = view;
  void instrumentsById;
  void priceIndex;
  const positions = localizedPositionFormats(input.language);
  const breakdown = computeValueBreakdown(view.summary);
  const concentration = computeConcentration(view.summary.rows);
  const brokerCash = input.data.brokerCash ?? [];
  const { additions, ...impact } = costImpact;
  void additions;
  const costScenarios = [true, false].flatMap((includeFees) =>
    [true, false].map((includeTaxes) => {
      const simulated = simulateCostExclusions(costImpact, view.series, view.summary.totalValue, includeFees, includeTaxes);
      return { includeFees, includeTaxes, active: simulated.active, value: simulated.value, extra: simulated.extra, series: simulated.series.map((point) => point.value) };
    }),
  );

  return {
    ...rest,
    today: todayKey,
    period: resolved.period,
    calculationPeriod: resolved.calculationPeriod,
    range: resolved.range ?? null,
    brokers: investmentBrokerGroups(input.all).map((group) => ({ ...group, label: translate(input.language, group.label), excluded: input.excludedBrokers.has(group.id) })),
    brokerCash,
    cashTotal: brokerCash.reduce((sum, cash) => sum + cash.balance, 0),
    usedInstrumentIds: usedInstruments.map((instrument) => instrument.id),
    breakdown,
    concentration,
    concentrationText: positions.concentrationText(concentration),
    priceNotes: view.summary.rows.map((row) => ({ instrumentId: row.instrument.id, ...positions.priceNote(row, todayKey) })),
    currencyExposure: computeCurrencyExposure(view.byCurrency, view.currency),
    costImpact: impact,
    costScenarios,
    reinvestmentEffects: reinvestmentEffects(costImpact),
    analysis: {
      ...analysis,
      exposureRows: analysis.exposureRows,
      sectorInsight: sectorInsight(analysis.sectors, input.language),
      areaInsight: areaInsight(analysis.areas, input.language),
      correlationPairs: analysis.correlations ? correlationPairs(analysis.correlations) : [],
      correlationFamilies: analysis.correlations ? correlationFamilies(analysis.correlations) : null,
      currentWeights: roundedCurrentWeights(view.summary.rows.map((row) => ({ instrumentId: row.instrument.id, value: row.value }))),
    },
    operationYears: operationYears(view.operationMonths),
    operationTotals: sumOperationTotals(view.operationMonths.flatMap((month) => month.operations)),
  };
}

/** Evenly spaced indexes of `length` points, at most `max`, always with the last one. */
export function sampleIndexes(length: number, max: number): number[] {
  if (length <= max) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (max - 1);
  return [...new Set(Array.from({ length: max }, (_, i) => Math.round(i * step)))];
}

/** Performance: `GET /api/investments/performance` (returns, inspect points, risk with its reading, heatmaps). */
export function buildInvestmentsPerformance(input: InvestmentsViewInputs & { selection: PortfolioChartRange | null }) {
  const todayKey = toDateKey(input.today);
  const resolved = resolvePeriod(input.period, input.customRange, todayKey);
  // A range dragged on the chart replaces the period's bounds, as `usePerformanceView` does.
  const range = input.selection ?? resolved.range;
  const view = compute(input, range, resolved.calculationPeriod);
  const locale = LANGUAGE_LOCALES[input.language];
  const insights = localizedReturnInsights(input.language);
  const riskInsights = localizedRiskInsights(input.language);
  const returns = view.returns;
  const benchmarkName = view.benchmark?.name ?? null;

  const values = (r: PortfolioReturns) => ({
    fromKey: r.fromKey,
    baseKey: r.baseKey,
    toKey: r.toKey,
    days: r.days,
    showAnnual: r.showAnnual,
    twr: r.twr,
    twrAnnual: r.twrAnnual,
    moneyWeighted: r.moneyWeighted,
    moneyWeightedAnnual: r.moneyWeightedAnnual,
    real: r.real,
    benchmarkStatus: r.benchmarkStatus,
    // The benchmark instrument is the top-level `benchmark`.
    benchmark: r.benchmark ? { twr: r.benchmark.twr, twrAnnual: r.benchmark.twrAnnual, simulatedValue: r.benchmark.simulatedValue, portfolioValue: r.benchmark.portfolioValue, moneyWeighted: r.benchmark.moneyWeighted, depleted: r.benchmark.depleted } : null,
    timingInsight: insights.timingInsight(r.twr, r.moneyWeighted),
  });

  let inspect: (ReturnType<typeof values> & { index: number; date: string })[] = [];
  if (returns && returns.series.length > 0) {
    const transactions = toTransactionInputs(input.data);
    const fx = buildFxTable(input.data.fxRates);
    inspect = sampleIndexes(returns.series.length, INSPECT_MAX_POINTS).flatMap((index) => {
      const date = returns.series[index].date;
      const at = computePortfolioReturns({
        transactions,
        fx,
        instruments: input.data.instruments,
        priceIndex: view.priceIndex,
        userCurrency: view.currency,
        benchmark: view.benchmark,
        inflation: returns.real ? input.data.inflation : null,
        today: input.today,
        period: resolved.calculationPeriod,
        range: { from: returns.fromKey, to: returns.toKey },
        asOf: date,
        locale,
      });
      return at ? [{ index, date, ...values(at) }] : [];
    });
  }

  const risk = view.analysis.risk;
  const heatmapToday = returns ? new Date(Number(returns.toKey.slice(0, 4)), Number(returns.toKey.slice(5, 7)) - 1, Number(returns.toKey.slice(8, 10))) : input.today;
  return {
    currency: view.currency,
    today: todayKey,
    period: resolved.period,
    calculationPeriod: resolved.calculationPeriod,
    range: resolved.range ?? null,
    selection: input.selection,
    hasTransactions: view.hasTransactions,
    benchmark: view.benchmark,
    benchmarkFirstPriceDate: view.benchmarkFirstPriceDate,
    returns: returns ? { ...values(returns), series: returns.series, daily: returns.daily } : null,
    benchmarkVerdict: returns?.benchmark ? insights.benchmarkVerdict(returns.benchmark) : null,
    inspect,
    risk: risk
      ? {
          ...risk,
          level: risk.volatility !== null ? riskInsights.riskLevel(risk.volatility) : null,
          levelLabel: risk.volatility !== null ? riskInsights.RISK_LEVEL_LABELS[riskInsights.riskLevel(risk.volatility)] : null,
          scalePosition: risk.volatility !== null ? riskInsights.riskScalePosition(risk.volatility) : null,
          levelInsight: risk.volatility !== null ? riskInsights.riskLevelInsight(riskInsights.riskLevel(risk.volatility)) : null,
          volatilityInsight: risk.volatility !== null ? riskInsights.volatilityInsight(risk.volatility, risk.benchmark?.volatility ?? null, benchmarkName) : null,
          sharpeLevel: risk.sharpe !== null ? riskInsights.sharpeLevel(risk.sharpe) : null,
          sharpeInsight: risk.sharpe !== null ? riskInsights.sharpeInsight(risk.sharpe) : null,
          betaInsight: risk.benchmark?.beta != null && benchmarkName ? riskInsights.betaInsight(risk.benchmark.beta, benchmarkName) : null,
          recoveryDays: risk.drawdown?.recoveryDate ? daysBetween(risk.drawdown.troughDate, risk.drawdown.recoveryDate) : null,
        }
      : null,
    correlationInsight: view.analysis.correlations ? riskInsights.correlationInsight(view.analysis.correlations) : null,
    heatmaps: Object.fromEntries(
      HEATMAP_GROUPINGS.map((grouping) => [grouping, returns && returns.daily.length > 0 ? heatmapFromDaily(returns.daily, grouping, heatmapToday, input.language) : null]),
    ) as Record<HeatmapGrouping, ReturnType<typeof heatmapFromDaily>>,
  };
}

export type InvestmentsViewData = ReturnType<typeof buildInvestmentsViewData>;
export type InvestmentsPerformance = ReturnType<typeof buildInvestmentsPerformance>;
