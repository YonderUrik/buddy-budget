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
import type { Instrument, InvestmentPlan, InvestmentTransaction } from "@/lib/db/schema/investments";
import type { InvestmentData } from "./data";
import { PLAN_FREQUENCY_MONTHS } from "./labels";
import { computeOperationInsights, groupOperationsByMonth, type OperationMonthGroup } from "./operations-history";

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
  /** Operazioni per mese, dal più recente, con l'esito di ciascuna. */
  operationMonths: OperationMonthGroup<InvestmentTransaction>[];
  /** Strumenti già usati, dal più recente: il selettore li propone senza doverli cercare. */
  usedInstruments: Instrument[];
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
 * Strumenti già usati dall'utente, per sceglierli senza cercarli: prima quelli delle operazioni più recenti, poi
 * quelli dei PAC senza operazioni. Gli id senza strumento corrispondente si saltano.
 */
export function usedInstruments(
  transactions: Pick<InvestmentTransaction, "instrumentId" | "date">[],
  plans: Pick<InvestmentPlan, "instrumentId">[],
  instrumentsById: Map<string, Instrument>
): Instrument[] {
  const byRecent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).map((t) => t.instrumentId);
  const ids = [...new Set([...byRecent, ...plans.map((p) => p.instrumentId)])];
  return ids.map((id) => instrumentsById.get(id)).filter((i): i is Instrument => i !== undefined);
}

/** Calcola tutto ciò che mostra la pagina Investimenti a partire dai dati grezzi dell'API. */
export function buildInvestmentsView(data: InvestmentData, period: NetWorthPeriod, today: Date): InvestmentsView {
  const transactions = toTransactionInputs(data);
  const instruments: InstrumentInput[] = data.instruments;
  const priceIndex = buildPriceIndex(data.prices, data.manualPrices, transactions);
  const fx = buildFxTable(data.fxRates);
  const common = { transactions, instruments, priceIndex, fx, userCurrency: data.currency };
  const todayKey = toDateKey(startOfDay(today));
  const summary = computePortfolioSummary({ ...common, todayKey });
  const operationMonths = groupOperationsByMonth(
    computeOperationInsights({ ...common, transactions: data.transactions, todayKey })
  );
  const activePlans = data.plans.filter((p) => p.active);
  const instrumentsById = new Map(data.instruments.map((i) => [i.id, i]));
  return {
    currency: data.currency,
    summary,
    series: buildPortfolioSeries({ ...common, period, today }),
    byType: computeComposition(summary.rows, "type"),
    byCurrency: computeComposition(summary.rows, "currency"),
    instruments: data.instruments,
    instrumentsById,
    priceIndex,
    activePlans,
    monthlyPlanAmount: activePlans.reduce((sum, p) => sum + Number(p.amount) / PLAN_FREQUENCY_MONTHS[p.frequency], 0),
    hasTransactions: transactions.length > 0,
    operationMonths,
    usedInstruments: usedInstruments(data.transactions, data.plans, instrumentsById),
  };
}
