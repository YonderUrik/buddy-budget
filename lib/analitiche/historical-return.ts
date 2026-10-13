import { parseDateOnly, startOfDay } from "@/lib/calc/expenses";
import type { FxTable } from "@/lib/calc/fx";
import type { InstrumentInput, InvestmentTransactionInput, PriceIndex } from "@/lib/calc/investments";
import { toDateKey } from "@/lib/calc/net-worth";
import { annualize, computePortfolioReturns, realReturn, type InflationPoint } from "@/lib/calc/returns";
import { ASSUMPTION_LIMITS, DEFAULT_ASSUMPTIONS, type AnalyticsAssumptions } from "./assumptions";

/** Sotto un anno di storico un rendimento annuo dice poco: si propone solo da qui in su. */
export const MIN_HISTORY_DAYS = 365;
/** Giorni di tolleranza sul minimo: chi ha iniziato 11 mesi e mezzo fa conta come un anno. */
const WINDOW_GRACE_DAYS = 15;
const DAYS_PER_MONTH = 365.25 / 12;
/** Sotto questo valore investito (in valuta utente) un rendimento in percentuale dice poco: non si propone. */
export const MIN_INVESTED_FOR_ESTIMATE = 1_000;
/** Sopra questo rendimento reale annuo le proiezioni diventano ottimistiche: si avvisa senza bloccare. */
export const HIGH_RETURN_WARNING = 0.08;

/** Perché non si propone un rendimento dallo storico. */
export type MissingReason = "nessun-investimento" | "storico-breve" | "periodo-breve" | "patrimonio-basso" | "prezzi-mancanti";

/** Rendimento osservato sul portafoglio, annuo e al netto di versamenti e prelievi (time-weighted). */
export interface HistoricalReturn {
  status: "ok";
  /** Mesi davvero coperti (meno del periodo scelto se si investe da meno tempo). */
  months: number;
  /** Lo storico parte dopo l'inizio del periodo scelto: si usa da quando si investe. */
  shorterThanPeriod: boolean;
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
  /** Periodo scelto (date AAAA-MM-GG comprese), di solito gli ultimi 12 o 24 mesi fino a oggi. */
  window: { fromKey: string; toKey: string };
  /** Valore attuale del portafoglio e strumenti senza prezzo (dal riepilogo già calcolato). */
  currentValue: number;
  unpricedCount: number;
}

function daysBetweenKeys(from: string, to: string): number {
  return Math.round((parseDateOnly(to).getTime() - parseDateOnly(from).getTime()) / 86_400_000);
}

/**
 * Rendimento del portafoglio nel periodo scelto (o da quando si investe, se è dopo), annualizzato e time-weighted: i
 * versamenti e i prelievi non contano come guadagno. Serve almeno un anno di storico. Senza dati sufficienti dice perché.
 */
export function historicalReturn(input: HistoricalReturnInput): HistoricalReturnResult {
  if (input.transactions.length === 0) return { status: "manca", reason: "nessun-investimento" };
  // Uno strumento senza prezzo vale zero nella serie ma il suo acquisto resta: sembrerebbe una perdita.
  if (input.unpricedCount > 0) return { status: "manca", reason: "prezzi-mancanti" };
  if (input.currentValue < MIN_INVESTED_FOR_ESTIMATE) return { status: "manca", reason: "patrimonio-basso" };

  const today = startOfDay(input.today);
  const todayKey = toDateKey(today);
  const toKey = input.window.toKey < todayKey ? input.window.toKey : todayKey;
  if (daysBetweenKeys(input.window.fromKey, toKey) < MIN_HISTORY_DAYS - WINDOW_GRACE_DAYS) return { status: "manca", reason: "periodo-breve" };
  const first = input.transactions.reduce((min, t) => (t.date < min ? t.date : min), input.transactions[0].date);
  const fromKey = first > input.window.fromKey ? first : input.window.fromKey;
  if (fromKey >= toKey || daysBetweenKeys(fromKey, toKey) < MIN_HISTORY_DAYS - WINDOW_GRACE_DAYS) return { status: "manca", reason: "storico-breve" };

  const returns = computePortfolioReturns({
    transactions: input.transactions,
    instruments: input.instruments,
    priceIndex: input.priceIndex,
    fx: input.fx,
    userCurrency: input.userCurrency,
    period: "max",
    today,
    range: { from: input.window.fromKey, to: toKey },
    inflation: input.inflation.length > 0 ? input.inflation : null,
  });
  if (!returns || returns.twr === null || returns.days <= 0) return { status: "manca", reason: "storico-breve" };
  const nominal = annualize(returns.twr, returns.days);
  if (nominal === null) return { status: "manca", reason: "storico-breve" };
  const real = returns.real ? annualize(returns.real.value, returns.days) : null;
  const months = Math.round(daysBetweenKeys(fromKey, toKey) / DAYS_PER_MONTH);
  return { status: "ok", months, shorterThanPeriod: fromKey > input.window.fromKey, fromKey: returns.fromKey, toKey: returns.toKey, nominal, real };
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
