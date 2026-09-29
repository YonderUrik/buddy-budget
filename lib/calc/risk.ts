/**
 * Rischio del portafoglio (Fase 3 Investimenti): volatilità, massima perdita dal picco, Sharpe, beta e correlazione
 * con l'indice di confronto, correlazioni tra le posizioni. Tutto puro, sui rendimenti giornalieri del TWR.
 */

import { parseDateOnly, startOfDay } from "./expenses";
import { convertAmount, findLastOnOrBefore, type FxTable } from "./fx";
import {
  computeDailyPortfolioValues,
  periodStartKey,
  priceMultiplier,
  samplePeriodSeries,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type PriceIndex,
} from "./investments";
import { addDays, toDateKey, type NetWorthPeriod } from "./net-worth";
import { computeDailyReturns, priceInUserCurrency, toDailyFlows, type DailyReturn } from "./returns";

const DAYS_PER_YEAR = 365;
/** Osservazioni minime per volatilità e perdita dal picco. */
export const MIN_VOLATILITY_OBSERVATIONS = 20;
/** Osservazioni minime per Sharpe, beta e correlazioni con l'indice. */
export const MIN_RELATION_OBSERVATIONS = 60;
/** Sotto circa un anno di sedute i numeri sono indicativi. */
export const FULL_YEAR_OBSERVATIONS = 250;
/** Posizioni massime nella matrice delle correlazioni (le più grandi per valore). */
export const MAX_CORRELATION_INSTRUMENTS = 8;
/** Giorni in comune minimi tra due strumenti per stimarne la correlazione. */
export const MIN_PAIR_OBSERVATIONS = 20;

/** Tasso d'interesse annuo di un giorno (frazione: 0,02 = 2%). */
export interface RateInput {
  date: string;
  rate: number;
}

/** Rendimento di un giorno di mercato. */
export interface RiskObservation {
  date: string;
  ret: number;
}

function isWeekend(dateKey: string): boolean {
  const day = parseDateOnly(dateKey).getDay();
  return day === 0 || day === 6;
}

/**
 * Giorni che contano per il rischio: niente giorni senza investito e niente sabato/domenica fermi (mercati chiusi:
 * abbasserebbero la volatilità). Con le crypto il weekend si muove e resta.
 */
export function riskObservations(daily: DailyReturn[]): RiskObservation[] {
  return daily
    .filter((d): d is DailyReturn & { ret: number } => d.ret !== null)
    .filter((d) => !(isWeekend(d.date) && d.ret === 0))
    .map((d) => ({ date: d.date, ret: d.ret }));
}

/** Osservazioni per anno dai dati stessi: circa 252 con le borse, 365 con sole crypto. */
export function observationsPerYear(observations: number, calendarDays: number): number | null {
  if (observations === 0 || calendarDays <= 0) return null;
  return (observations * DAYS_PER_YEAR) / calendarDays;
}

export function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Deviazione standard campionaria (n − 1); null con meno di due valori. */
export function sampleStd(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function covariance(x: number[], y: number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let sum = 0;
  for (let i = 0; i < x.length; i += 1) sum += (x[i] - mx) * (y[i] - my);
  return sum / (x.length - 1);
}

/** Correlazione di Pearson; null con meno di due coppie o se una serie non si muove. */
export function correlation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  const sx = sampleStd(x);
  const sy = sampleStd(y);
  if (!sx || !sy) return null;
  return Math.max(-1, Math.min(1, covariance(x, y) / (sx * sy)));
}

/** Beta di `x` rispetto a `y` (cov / var di y); null se y non si muove. */
export function beta(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  const sy = sampleStd(y);
  if (!sy) return null;
  return covariance(x, y) / sy ** 2;
}

/** Perdita dal picco di un giorno (0 o negativa). */
export interface DrawdownPoint {
  date: string;
  drawdown: number;
}

/** Massima perdita dal picco nel periodo. */
export interface MaxDrawdown {
  /** Perdita (negativa); 0 se non c'è mai stata. */
  depth: number;
  peakDate: string;
  troughDate: string;
  /** Primo giorno di nuovo al picco, null se non ancora recuperata. */
  recoveryDate: string | null;
  /** Perdita dal picco a fine periodo. */
  current: number;
}

/** Perdita dal picco giorno per giorno sull'indice del TWR (non sul valore, che salirebbe con i versamenti). */
export function computeDrawdown(baseKey: string, daily: DailyReturn[]): { series: DrawdownPoint[]; max: MaxDrawdown | null } {
  let index = 1;
  let peak = 1;
  let peakDate = baseKey;
  let worst: MaxDrawdown | null = null;
  let current = 0;
  const series: DrawdownPoint[] = [];
  for (const day of daily) {
    if (day.ret !== null) index *= 1 + day.ret;
    if (index >= peak) {
      if (worst && worst.recoveryDate === null && worst.depth < 0 && worst.peakDate === peakDate) worst.recoveryDate = day.date;
      peak = index;
      peakDate = day.date;
    }
    current = index / peak - 1;
    series.push({ date: day.date, drawdown: current });
    if (!worst || current < worst.depth) worst = { depth: current, peakDate, troughDate: day.date, recoveryDate: null, current: 0 };
  }
  if (worst) worst.current = current;
  return { series, max: worst };
}

/** Un punto per mese col minimo del mese, per non nascondere il fondo nei grafici di periodi lunghi. */
function monthlyMinimum(series: DrawdownPoint[]): DrawdownPoint[] {
  const byMonth = new Map<string, DrawdownPoint>();
  for (const point of series) {
    const month = point.date.slice(0, 7);
    const current = byMonth.get(month);
    if (!current || point.drawdown < current.drawdown) byMonth.set(month, point);
  }
  return [...byMonth.values()];
}

/** Confronto del rischio con l'indice scelto. */
export interface BenchmarkRisk {
  volatility: number | null;
  beta: number | null;
  correlation: number | null;
}

/** Rischio del portafoglio sul periodo. Le percentuali sono quote (0,12 = 12%). */
export interface PortfolioRisk {
  observations: number;
  /** Meno di circa un anno di sedute: numeri indicativi. */
  fewData: boolean;
  volatility: number | null;
  drawdown: MaxDrawdown | null;
  drawdownSeries: (DrawdownPoint & { label: string })[];
  sharpe: number | null;
  /** €STR medio usato nello Sharpe; null se non disponibile (si usa zero). */
  riskFreeRate: number | null;
  benchmark: BenchmarkRisk | null;
}

/** Media dei tassi alle date osservate (ultimo valore disponibile a ogni data), null se nessuno. */
export function averageRate(rates: RateInput[], dates: string[]): number | null {
  if (rates.length === 0) return null;
  const sorted = [...rates].sort((a, b) => a.date.localeCompare(b.date));
  const found = dates.map((d) => findLastOnOrBefore(sorted, d)?.rate).filter((r): r is number => r !== undefined);
  return found.length > 0 ? mean(found) : null;
}

/** Sharpe annuo da rendimenti giornalieri: (media − tasso/osservazioni per anno) / dev. std × √osservazioni per anno. */
export function sharpeRatio(returns: number[], perYear: number, annualRiskFree: number): number | null {
  const std = sampleStd(returns);
  if (!std) return null;
  return ((mean(returns) - annualRiskFree / perYear) / std) * Math.sqrt(perYear);
}

/**
 * Rischio sul periodo scelto (lo stesso del grafico). `benchmark` va passato con i suoi prezzi dentro `priceIndex`;
 * `riskFreeRates` solo se la valuta dell'utente è EUR.
 */
export function computePortfolioRisk(params: {
  transactions: InvestmentTransactionInput[];
  instruments: InstrumentInput[];
  priceIndex: PriceIndex;
  fx: FxTable;
  userCurrency: string;
  period: NetWorthPeriod;
  today: Date;
  benchmark?: InstrumentInput | null;
  riskFreeRates?: RateInput[] | null;
}): PortfolioRisk | null {
  const { transactions, priceIndex, fx, userCurrency, period, today, benchmark, riskFreeRates } = params;
  const fromKey = periodStartKey(transactions, period, today);
  if (fromKey === null) return null;
  const baseKey = toDateKey(addDays(parseDateOnly(fromKey), -1));
  const toKey = toDateKey(startOfDay(today));
  const points = computeDailyPortfolioValues({ ...params, fromKey: baseKey, toKey });
  const daily = computeDailyReturns(points[0].value, toDailyFlows(points));
  const observations = riskObservations(daily);
  const calendarDays = daily.filter((d) => d.ret !== null).length;
  const perYear = observationsPerYear(observations.length, calendarDays);
  const returns = observations.map((o) => o.ret);
  const enough = observations.length >= MIN_VOLATILITY_OBSERVATIONS && perYear !== null;
  const std = sampleStd(returns);
  const volatility = enough && std !== null ? std * Math.sqrt(perYear) : null;

  const drawdown = computeDrawdown(baseKey, daily.filter((d) => d.ret !== null));
  const shortPeriod = period === "1mese" || period === "3mesi";
  const drawdownSeries = samplePeriodSeries(shortPeriod ? drawdown.series : monthlyMinimum(drawdown.series), period);

  const relations = observations.length >= MIN_RELATION_OBSERVATIONS && perYear !== null;
  const riskFreeRate = riskFreeRates ? averageRate(riskFreeRates, observations.map((o) => o.date)) : null;
  const sharpe = relations ? sharpeRatio(returns, perYear, riskFreeRate ?? 0) : null;

  let benchmarkRisk: BenchmarkRisk | null = null;
  if (benchmark && enough) {
    const priceAt = (key: string) => priceInUserCurrency(benchmark, priceIndex, fx, userCurrency, key);
    const pairs: { p: number; b: number }[] = [];
    for (const o of observations) {
      const close = priceAt(o.date);
      const previous = priceAt(toDateKey(addDays(parseDateOnly(o.date), -1)));
      if (close !== null && previous !== null && previous > 0) pairs.push({ p: o.ret, b: close / previous - 1 });
    }
    const benchmarkReturns = pairs.map((x) => x.b);
    const benchmarkStd = pairs.length >= MIN_VOLATILITY_OBSERVATIONS ? sampleStd(benchmarkReturns) : null;
    const related = pairs.length >= MIN_RELATION_OBSERVATIONS;
    benchmarkRisk = {
      volatility: benchmarkStd !== null ? benchmarkStd * Math.sqrt(perYear) : null,
      beta: related ? beta(pairs.map((x) => x.p), benchmarkReturns) : null,
      correlation: related ? correlation(pairs.map((x) => x.p), benchmarkReturns) : null,
    };
  }

  return {
    observations: observations.length,
    fewData: observations.length < FULL_YEAR_OBSERVATIONS,
    volatility,
    drawdown: enough ? drawdown.max : null,
    drawdownSeries: enough ? drawdownSeries : [],
    sharpe,
    riskFreeRate,
    benchmark: benchmarkRisk,
  };
}

/** Matrice delle correlazioni tra posizioni. */
export interface CorrelationMatrix {
  instrumentIds: string[];
  /** `values[i][j]`: correlazione tra lo strumento i e j (1 sulla diagonale), null se pochi giorni in comune. */
  values: (number | null)[][];
}

/** Prezzi osservati di uno strumento in valuta utente da `fromKey` (più l'ultimo prima) a `toKey`. */
function observedPrices(
  instrument: InstrumentInput,
  priceIndex: PriceIndex,
  fx: FxTable,
  userCurrency: string,
  fromKey: string,
  toKey: string
): Map<string, number> {
  const prices = (priceIndex.get(instrument.id) ?? []).filter((p) => p.origin !== "operazione" && p.date <= toKey);
  const firstInside = prices.findIndex((p) => p.date >= fromKey);
  const start = firstInside < 0 ? prices.length : Math.max(0, firstInside - 1);
  const result = new Map<string, number>();
  for (const p of prices.slice(start)) {
    const value = convertAmount(fx, p.close * priceMultiplier(instrument.priceUnit), instrument.currency, userCurrency, p.date);
    if (value !== null && value > 0) result.set(p.date, value);
  }
  return result;
}

/**
 * Correlazione tra due strumenti sui rendimenti calcolati solo nei giorni in cui **entrambi** hanno una chiusura:
 * così i rendimenti coprono gli stessi intervalli e un prezzo vecchio non finge un giorno fermo.
 */
export function pairCorrelation(a: Map<string, number>, b: Map<string, number>): number | null {
  const common = [...a.keys()].filter((d) => b.has(d)).sort();
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 1; i < common.length; i += 1) {
    x.push((a.get(common[i]) ?? 0) / (a.get(common[i - 1]) ?? 1) - 1);
    y.push((b.get(common[i]) ?? 0) / (b.get(common[i - 1]) ?? 1) - 1);
  }
  return x.length >= MIN_PAIR_OBSERVATIONS ? correlation(x, y) : null;
}

/** Correlazioni tra gli strumenti dati (già ordinati e limitati) nel periodo. */
export function computeCorrelationMatrix(params: {
  instruments: InstrumentInput[];
  priceIndex: PriceIndex;
  fx: FxTable;
  userCurrency: string;
  fromKey: string;
  toKey: string;
}): CorrelationMatrix {
  const { instruments, priceIndex, fx, userCurrency, fromKey, toKey } = params;
  const series = instruments.map((i) => observedPrices(i, priceIndex, fx, userCurrency, fromKey, toKey));
  const values: (number | null)[][] = instruments.map((_, i) => instruments.map((__, j) => (i === j ? 1 : null)));
  for (let i = 0; i < instruments.length; i += 1) {
    for (let j = i + 1; j < instruments.length; j += 1) {
      const value = pairCorrelation(series[i], series[j]);
      values[i][j] = value;
      values[j][i] = value;
    }
  }
  return { instrumentIds: instruments.map((i) => i.id), values };
}
