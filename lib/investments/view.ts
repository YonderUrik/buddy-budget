import { buildFxTable } from "@/lib/calc/fx";
import {
  buildPortfolioSeries,
  buildPriceIndex,
  computeComposition,
  computePortfolioSummary,
  type CompositionSlice,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type PortfolioSeriesPoint,
  type PortfolioSummary,
  type PriceIndex,
} from "@/lib/calc/investments";
import { toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import type { Instrument, InvestmentPlan } from "@/lib/db/schema/investments";
import type { InvestmentData } from "./data";
import { PLAN_FREQUENCY_MONTHS } from "./labels";

/** Dati della pagina Investimenti già calcolati: la UI li riceve pronti. */
export interface InvestmentsView {
  currency: string;
  summary: PortfolioSummary;
  series: PortfolioSeriesPoint[];
  byType: CompositionSlice[];
  byCurrency: CompositionSlice[];
  instruments: Instrument[];
  instrumentsById: Map<string, Instrument>;
  priceIndex: PriceIndex;
  activePlans: InvestmentPlan[];
  /** Importo mensile equivalente dei PAC attivi (un PAC trimestrale da 300 vale 100 al mese). */
  monthlyPlanAmount: number;
  hasTransactions: boolean;
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

/** Calcola tutto ciò che mostra la pagina Investimenti a partire dai dati grezzi dell'API. */
export function buildInvestmentsView(data: InvestmentData, period: NetWorthPeriod, today: Date): InvestmentsView {
  const transactions = toTransactionInputs(data);
  const instruments: InstrumentInput[] = data.instruments;
  const priceIndex = buildPriceIndex(data.prices, data.manualPrices, transactions);
  const fx = buildFxTable(data.fxRates);
  const common = { transactions, instruments, priceIndex, fx, userCurrency: data.currency };
  const summary = computePortfolioSummary({ ...common, todayKey: toDateKey(startOfDay(today)) });
  const activePlans = data.plans.filter((p) => p.active);
  return {
    currency: data.currency,
    summary,
    series: buildPortfolioSeries({ ...common, period, today }),
    byType: computeComposition(summary.rows, "type"),
    byCurrency: computeComposition(summary.rows, "currency"),
    instruments: data.instruments,
    instrumentsById: new Map(data.instruments.map((i) => [i.id, i])),
    priceIndex,
    activePlans,
    monthlyPlanAmount: activePlans.reduce((sum, p) => sum + Number(p.amount) / PLAN_FREQUENCY_MONTHS[p.frequency], 0),
    hasTransactions: transactions.length > 0,
  };
}
