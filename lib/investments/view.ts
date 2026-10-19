import { countryFeatures } from "@/lib/localization/config";
import { investmentTaxReport } from "./tax-report";
import { computePeriodGain, type PeriodGain } from "./period-gain";
import { computeCostImpact, type CostImpact } from "./cost-impact";
import { buildFxTable } from "@/lib/calc/fx";
import {
  buildPortfolioSeries,
  buildPriceIndex,
  computeComposition,
  computePositions,
  computePortfolioSummary,
  type CompositionSlice,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type PortfolioSeriesPoint,
  type PortfolioSummary,
  type PriceIndex,
} from "@/lib/calc/investments";
import { toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import { computePortfolioReturns, type PortfolioReturns } from "@/lib/calc/returns";
import { startOfDay } from "@/lib/calc/expenses";
import type { Instrument, InvestmentTransaction } from "@/lib/db/schema/investments";
import { buildInvestmentsAnalysis, type InvestmentsAnalysis } from "./analysis-view";
import type { InvestmentData } from "./data";
import { computeIncomeHistory, type IncomeHistory } from "./income";
import { computeOperationInsights, groupOperationsByMonth, type OperationMonthGroup } from "./operations-history";

/** Dati della pagina Investimenti già calcolati: la UI li riceve pronti. */
export interface InvestmentsView {
  costImpact: CostImpact;
  /** Guadagno nel periodo scelto (non dall'inizio), null senza operazioni. */
  periodGain: PeriodGain | null;
  currency: string;
  summary: PortfolioSummary;
  series: PortfolioSeriesPoint[];
  byType: CompositionSlice[];
  byCurrency: CompositionSlice[];
  instruments: Instrument[];
  instrumentsById: Map<string, Instrument>;
  priceIndex: PriceIndex;
  hasTransactions: boolean;
  /** Operazioni per mese, dal più recente, con l'esito di ciascuna. */
  operationMonths: OperationMonthGroup<InvestmentTransaction>[];
  /** Instruments the user holds today, most recently traded first: the picker offers them as «I tuoi strumenti». */
  heldInstruments: Instrument[];
  /** Rendimenti del periodo (TWR, money-weighted, reale, benchmark), null senza operazioni. */
  returns: PortfolioReturns | null;
  /** Strumento di confronto scelto, o null. */
  benchmark: Instrument | null;
  /** Primo prezzo caricato del benchmark (per spiegare un confronto che non parte), o null. */
  benchmarkFirstPriceDate: string | null;
  /** Storico di dividendi e cedole. */
  income: IncomeHistory;
  /** Rischio, diversificazione, sovrapposizioni e allocazione obiettivo (Fase 3). */
  analysis: InvestmentsAnalysis;
}

/** Operazioni del DB nella forma dei calcoli. */
export function toTransactionInputs(data: InvestmentData): InvestmentTransactionInput[] {
  return data.transactions.map((t) => ({
    id: t.id,
    instrumentId: t.instrumentId,
    type: t.type,
    date: t.date,
    quantity: t.quantity,
    price: t.price,
    fxRate: t.fxRate,
    fees: t.fees,
    taxes: t.taxes,
    grossAmount: t.grossAmount,
  }));
}

/**
 * Instruments the user holds today (quantity above zero), most recently traded first, for picking them without a
 * search. Sold-out positions, target-only and benchmark instruments are left out: under «I tuoi strumenti» they
 * looked like someone else's. Ids without a matching instrument are skipped.
 */
export function heldInstruments(
  transactions: InvestmentTransactionInput[],
  instrumentsById: Map<string, Instrument>,
  todayKey: string
): Instrument[] {
  const positions = computePositions(transactions, [...instrumentsById.values()], todayKey);
  const byRecent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).map((t) => t.instrumentId);
  const ids = [...new Set(byRecent)].filter((id) => (positions.get(id)?.quantity ?? 0) > 0);
  return ids.map((id) => instrumentsById.get(id)).filter((i): i is Instrument => i !== undefined);
}

/** Calcola tutto ciò che mostra la pagina Investimenti a partire dai dati grezzi dell'API. */
export function buildInvestmentsView(data: InvestmentData, period: NetWorthPeriod, today: Date, chartRange?: { from: string; to: string }, locale = "it-IT"): InvestmentsView {
  const transactions = toTransactionInputs(data);
  const instruments: InstrumentInput[] = data.instruments;
  const priceIndex = buildPriceIndex(data.prices, data.manualPrices, transactions);
  const fx = buildFxTable(data.fxRates);
  const common = { transactions, instruments, priceIndex, fx, userCurrency: data.currency };
  const todayKey = toDateKey(startOfDay(today));
  const summary = computePortfolioSummary({ ...common, todayKey });
  const insights = computeOperationInsights({ ...common, transactions: data.transactions, todayKey });
  const operationMonths = groupOperationsByMonth(insights, locale);
  const instrumentsById = new Map(data.instruments.map((i) => [i.id, i]));
  const analysis = buildInvestmentsAnalysis({
    ...common,
    summary,
    instrumentsById,
    profiles: data.profiles,
    manualBreakdowns: data.manualBreakdowns,
    targets: data.targets,
    benchmark: data.benchmark,
    riskFreeRates: data.riskFreeRates.length > 0 ? data.riskFreeRates : null,
    period,
    today,
    range: chartRange,
    locale,
  });
  const returns = computePortfolioReturns({
    ...common,
    period,
    today,
    benchmark: data.benchmark,
    range: chartRange,
    dailySeries: true,
    inflation: data.inflation.length > 0 ? data.inflation : null,
    locale,
  });
  return {
    currency: data.currency,
    summary,
    series: buildPortfolioSeries({ ...common, period, today, range: chartRange, locale }),
    byType: computeComposition(summary.rows, "type"),
    byCurrency: computeComposition(summary.rows, "currency"),
    instruments: data.instruments,
    instrumentsById,
    priceIndex,
    hasTransactions: transactions.length > 0,
    operationMonths,
    heldInstruments: heldInstruments(transactions, instrumentsById, todayKey),
    returns,
    periodGain: computePeriodGain({ ...common, period, today, range: chartRange }),
    costImpact: computeCostImpact({ ...common, period, today }, summary.unpricedCount > 0, countryFeatures(data.productCountry ?? "IT").taxes ? investmentTaxReport(data, transactions, todayKey) : null),
    benchmark: data.benchmark,
    benchmarkFirstPriceDate: data.benchmark ? (priceIndex.get(data.benchmark.id)?.[0]?.date ?? null) : null,
    income: computeIncomeHistory(insights, summary.costBasis, todayKey),
    analysis,
  };
}
