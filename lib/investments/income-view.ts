import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex, computePortfolioSummary, type PositionRow } from "@/lib/calc/investments";
import { toDateKey } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import type { Instrument } from "@/lib/db/schema/investments";
import type { InvestmentData } from "./data";
import {
  findMissingIncome,
  forecastIncome,
  incomeByInstrument,
  incomeByMonth,
  type IncomeForecast,
  type IncomeInput,
  type IncomeInstrumentRow,
  type IncomeYearDetail,
  type MissingIncome,
} from "./dividends";
import { computeIncomeHistory, type IncomeHistory } from "./income";
import { computeOperationInsights } from "./operations-history";
import { resolveTaxSettings, toTaxInstruments, type ResolvedTaxSettings } from "./tax-settings";
import { toTransactionInputs } from "./view";

/** Dati della scheda Proventi già calcolati. */
export interface IncomeView {
  currency: string;
  todayKey: string;
  instrumentsById: Map<string, Instrument>;
  hasTransactions: boolean;
  /** Riepilogo di sempre e degli ultimi 12 mesi (card della Fase 2). */
  history: IncomeHistory;
  missing: MissingIncome[];
  forecast: IncomeForecast;
  byMonth: IncomeYearDetail[];
  byInstrument: IncomeInstrumentRow[];
  rows: PositionRow[];
  taxSettings: Map<string, ResolvedTaxSettings>;
  /** Strumenti posseduti che potrebbero pagare ma il cui storico dividendi non è ancora arrivato. */
  pendingDividendHistory: number;
}

/** Calcola la scheda Proventi dai dati dell'overview. */
export function buildIncomeView(data: InvestmentData, today: Date): IncomeView {
  const todayKey = toDateKey(startOfDay(today));
  const transactions = toTransactionInputs(data);
  const priceIndex = buildPriceIndex(data.prices, data.manualPrices, transactions);
  const fx = buildFxTable(data.fxRates);
  const common = { transactions, instruments: data.instruments, priceIndex, fx, userCurrency: data.currency, todayKey };
  const summary = computePortfolioSummary(common);
  const insights = computeOperationInsights({ ...common, transactions: data.transactions });
  const input: IncomeInput = {
    transactions,
    instruments: data.instruments,
    taxInstruments: toTaxInstruments(data.instruments, data.instrumentSettings),
    settings: data.instrumentSettings,
    dividends: data.dividends,
    fx,
    userCurrency: data.currency,
    todayKey,
  };
  const forecast = forecastIncome(input);
  const settingsById = new Map(data.instrumentSettings.map((s) => [s.instrumentId, s]));
  const heldIds = new Set(summary.rows.map((r) => r.instrument.id));
  const withHistory = new Set(data.dividends.map((d) => d.instrumentId));
  return {
    currency: data.currency,
    todayKey,
    instrumentsById: new Map(data.instruments.map((i) => [i.id, i])),
    hasTransactions: transactions.length > 0,
    history: computeIncomeHistory(insights, summary.costBasis, todayKey),
    missing: findMissingIncome(input, data.dismissedDividends),
    forecast,
    byMonth: incomeByMonth(transactions, todayKey),
    byInstrument: incomeByInstrument(input, summary.rows, forecast),
    rows: summary.rows,
    taxSettings: new Map(data.instruments.map((i) => [i.id, resolveTaxSettings(i, settingsById.get(i.id))])),
    pendingDividendHistory: data.instruments.filter(
      (i) =>
        heldIds.has(i.id) &&
        i.priceMode === "auto" &&
        (i.type === "azione" || i.type === "etf" || i.type === "fondo") &&
        !withHistory.has(i.id) &&
        i.dividendsFetchedAt === null
    ).length,
  };
}
