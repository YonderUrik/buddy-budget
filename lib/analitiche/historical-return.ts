import { addMonths, startOfDay } from "@/lib/calc/expenses";
import type { FxTable } from "@/lib/calc/fx";
import type { InstrumentInput, InvestmentTransactionInput, PriceIndex } from "@/lib/calc/investments";
import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { annualize, computePortfolioReturns, realReturn, type InflationPoint } from "@/lib/calc/returns";
import { ASSUMPTION_LIMITS, DEFAULT_ASSUMPTIONS, type AnalyticsAssumptions } from "./assumptions";

/** Finestre provate, dalla più lunga: si usa la prima coperta dallo storico. */
export const HISTORY_WINDOWS = [24, 12] as const;
export type HistoryWindow = (typeof HISTORY_WINDOWS)[number];
/** Giorni di tolleranza sull'inizio della finestra: chi ha iniziato 23 mesi e mezzo fa conta come 24 mesi. */
const WINDOW_GRACE_DAYS = 15;
/** Sotto questo valore investito (in valuta utente) un rendimento in percentuale dice poco: non si propone. */
export const MIN_INVESTED_FOR_ESTIMATE = 1_000;
/** Sopra questo rendimento reale annuo le proiezioni diventano ottimistiche: si avvisa senza bloccare. */
export const HIGH_RETURN_WARNING = 0.08;

/** Perché non si propone un rendimento dallo storico. */
export type MissingReason = "nessun-investimento" | "storico-breve" | "patrimonio-basso" | "prezzi-mancanti";

/** Rendimento osservato sul portafoglio, annuo e al netto di versamenti e prelievi (time-weighted). */
export interface HistoricalReturn {
  status: "ok";
  months: HistoryWindow;
  fromKey: string;
  toKey: string;
  /** Rendimento annuo prima dell'inflazione. */
  nominal: number;
  /** Rendimento annuo al netto dell'inflazione osservata nel periodo; null se l'indice dei prezzi non copre il periodo. */
  real: number | null;
}

export type HistoricalReturnResult = HistoricalReturn | { status: "manca"; reason: MissingReason };

export interface HistoricalReturnInput {
  transactions: InvestmentTransactionInput[];
  instruments: InstrumentInput[];
  priceIndex: PriceIndex;
  fx: FxTable;
  userCurrency: string;
  inflation: InflationPoint[];
  today: Date;
  /** Valore attuale del portafoglio e strumenti senza prezzo (dal riepilogo già calcolato). */
  currentValue: number;
  unpricedCount: number;
}

/**
 * Rendimento del portafoglio negli ultimi 24 mesi (o 12 se lo storico è più corto), annualizzato e time-weighted: i
 * versamenti e i prelievi non contano come guadagno. Null-safe: senza abbastanza storico o patrimonio dice perché.
 */
export function historicalReturn(input: HistoricalReturnInput): HistoricalReturnResult {
  if (input.transactions.length === 0) return { status: "manca", reason: "nessun-investimento" };
  // Uno strumento senza prezzo vale zero nella serie ma il suo acquisto resta: sembrerebbe una perdita.
  if (input.unpricedCount > 0) return { status: "manca", reason: "prezzi-mancanti" };
  if (input.currentValue < MIN_INVESTED_FOR_ESTIMATE) return { status: "manca", reason: "patrimonio-basso" };

  const today = startOfDay(input.today);
  const first = input.transactions.reduce((min, t) => (t.date < min ? t.date : min), input.transactions[0].date);
  const months = HISTORY_WINDOWS.find((m) => first <= toDateKey(addDays(addMonths(today, -m), WINDOW_GRACE_DAYS)));
  if (months === undefined) return { status: "manca", reason: "storico-breve" };

  const fromKey = toDateKey(addMonths(today, -months));
  const toKey = toDateKey(today);
  const returns = computePortfolioReturns({
    transactions: input.transactions,
    instruments: input.instruments,
    priceIndex: input.priceIndex,
    fx: input.fx,
    userCurrency: input.userCurrency,
    period: "max",
    today,
    range: { from: fromKey, to: toKey },
    inflation: input.inflation.length > 0 ? input.inflation : null,
  });
  if (!returns || returns.twr === null || returns.days <= 0) return { status: "manca", reason: "storico-breve" };
  const nominal = annualize(returns.twr, returns.days);
  if (nominal === null) return { status: "manca", reason: "storico-breve" };
  const real = returns.real ? annualize(returns.real.value, returns.days) : null;
  return { status: "ok", months, fromKey: returns.fromKey, toKey: returns.toKey, nominal, real };
}

/** Da dove viene il rendimento usato nei calcoli. */
export type ReturnSource = "storico" | "prudente" | "manuale";

/** Rendimento reale usato da Analitiche e la sua origine, per spiegarlo all'utente. */
export interface ExpectedReturnInfo {
  value: number;
  source: ReturnSource;
  /** Lo storico, se c'è (anche quando l'utente ha scelto un valore suo: serve per proporglielo). */
  history: HistoricalReturnResult;
  /** Rendimento reale annuo dello storico prima di stare nei limiti, null senza storico. */
  historyReal: number | null;
  /** Lo storico è uscito dai limiti ed è stato portato al più vicino. */
  clamped: boolean;
  /** Sopra la soglia di prudenza: le proiezioni rischiano di essere troppo ottimistiche. */
  high: boolean;
}

/** Reale annuo dello storico: con l'inflazione osservata se c'è, altrimenti con quella delle ipotesi. */
export function historyRealReturn(history: HistoricalReturn, assumedInflation: number): number {
  return history.real ?? realReturn(history.nominal, assumedInflation);
}

/**
 * Rendimento da usare: quello scelto dall'utente, oppure (in automatico) quello reale degli ultimi mesi, tenuto nei
 * limiti delle ipotesi; senza storico sufficiente il valore prudente di partenza.
 */
export function resolveExpectedReturn(a: AnalyticsAssumptions, history: HistoricalReturnResult): ExpectedReturnInfo {
  const { min, max } = ASSUMPTION_LIMITS.expectedReturn;
  const historyReal = history.status === "ok" ? historyRealReturn(history, a.inflation) : null;
  const fromHistory = historyReal === null ? null : Math.min(Math.max(historyReal, min), max);
  const base = { history, historyReal, clamped: false };
  let info: Omit<ExpectedReturnInfo, "high">;
  if (!a.expectedReturnAuto) info = { ...base, value: a.expectedReturn, source: "manuale" };
  else if (fromHistory === null) info = { ...base, value: DEFAULT_ASSUMPTIONS.expectedReturn, source: "prudente" };
  else info = { ...base, value: Math.round(fromHistory * 1000) / 1000, source: "storico", clamped: fromHistory !== historyReal };
  return { ...info, high: info.value > HIGH_RETURN_WARNING };
}

/** Le ipotesi con il rendimento effettivamente usato al posto di quello salvato. */
export function withExpectedReturn(a: AnalyticsAssumptions, info: ExpectedReturnInfo): AnalyticsAssumptions {
  return info.value === a.expectedReturn ? a : { ...a, expectedReturn: info.value };
}
