/**
 * Rendimenti del portafoglio (Fase 2 Investimenti): rendimento del portafoglio (TWR), rendimento dei tuoi soldi
 * (money-weighted, XIRR), confronto con un benchmark a parità di versamenti e rendimento al netto dell'inflazione.
 * Tutto puro: riceve i punti giornalieri già calcolati da `computeDailyPortfolioValues`.
 */

import { parseDateOnly, startOfDay } from "./expenses";
import { convertAmount, type FxTable } from "./fx";
import {
  computeDailyPortfolioValues,
  periodStartKey,
  priceMultiplier,
  resolvePrice,
  samplePeriodSeries,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type PortfolioDailyPoint,
  type PriceIndex,
} from "./investments";
import { addDays, toDateKey, type NetWorthPeriod } from "./net-worth";

const DAYS_PER_YEAR = 365;
const MS_PER_DAY = 86_400_000;
/** Sotto questa soglia un importo è considerato zero (evita divisioni su resti di arrotondamento). */
const AMOUNT_EPSILON = 1e-6;
/** Iterazioni della bisezione: 200 dimezzamenti bastano ben oltre la precisione dei double. */
const XIRR_ITERATIONS = 200;
/** Massimo tasso logaritmico giornaliero cercato (e^1 ≈ ×2,7 al giorno): oltre non ha senso per un portafoglio. */
const XIRR_MAX_DAILY_LOG_RATE = 1;
/** `exp` resta finito fino a ~709: il tasso massimo si riduce sui periodi lunghi per non andare in overflow. */
const XIRR_MAX_EXPONENT = 700;

/** Movimenti di denaro di un giorno, in valuta utente. */
export interface DailyFlow {
  date: string;
  /** Valore del portafoglio a fine giornata. */
  value: number;
  /** Acquisti del giorno, commissioni incluse. */
  inflow: number;
  /** Incasso netto di vendite e rimborsi del giorno: esce a fine giornata. */
  outflow: number;
  /** Dividendi e cedole netti del giorno: escono a fine giornata. */
  income: number;
}

/** Movimenti giorno per giorno dai punti cumulati; il primo punto è la base (il giorno prima del periodo). */
export function toDailyFlows(points: PortfolioDailyPoint[]): DailyFlow[] {
  const flows: DailyFlow[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const inflow = current.bought - previous.bought;
    // Incassato cumulato = acquistato − investito netto.
    const outflow = current.bought - current.invested - (previous.bought - previous.invested);
    flows.push({ date: current.date, value: current.value, inflow, outflow, income: current.income - previous.income });
  }
  return flows;
}

/**
 * Rendimento cumulato giorno per giorno. Se il giorno prima c'era qualcosa investito i movimenti si considerano a
 * fine giornata: `(V_t − entrate + uscite + proventi) / V_{t−1} − 1`, così un acquisto in un giorno di rialzo non
 * prende il rialzo delle quote già possedute. Se non c'era niente, il giorno misura il primo acquisto rispetto alla
 * chiusura: `(V_t + uscite + proventi) / entrate − 1`. I giorni senza niente investito non contano.
 */
export function computeTwrSeries(baseValue: number, flows: DailyFlow[]): { date: string; cumulative: number }[] {
  let index = 1;
  let previousValue = baseValue;
  return flows.map((day) => {
    const gained = day.value + day.outflow + day.income;
    if (previousValue > AMOUNT_EPSILON) index *= (gained - day.inflow) / previousValue;
    else if (day.inflow > AMOUNT_EPSILON) index *= gained / day.inflow;
    previousValue = day.value;
    return { date: day.date, cumulative: index - 1 };
  });
}

/** Da un rendimento su `days` giorni a quello annuo equivalente. */
export function annualize(periodReturn: number, days: number): number | null {
  if (days <= 0 || periodReturn <= -1) return null;
  return (1 + periodReturn) ** (DAYS_PER_YEAR / days) - 1;
}

/** Flusso dal punto di vista dell'investitore: negativo quando versa, positivo quando incassa. */
export interface CashFlow {
  date: string;
  amount: number;
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((parseDateOnly(toKey).getTime() - parseDateOnly(fromKey).getTime()) / MS_PER_DAY);
}

/**
 * Tasso interno di rendimento dei flussi, espresso come tasso **giornaliero** (null se non esiste o se i flussi
 * non cambiano segno). La bisezione lavora sul logaritmo del tasso giornaliero: è limitato anche su pochi giorni
 * (dove il tasso annuo equivalente può essere enorme) e gli sconti `exp(−h·giorni)` non vanno in overflow.
 */
export function xirrDaily(flows: CashFlow[]): number | null {
  const relevant = flows.filter((f) => Math.abs(f.amount) > AMOUNT_EPSILON);
  if (!relevant.some((f) => f.amount > 0) || !relevant.some((f) => f.amount < 0)) return null;
  const firstDate = relevant.reduce((min, f) => (f.date < min ? f.date : min), relevant[0].date);
  const timed = relevant.map((f) => ({ amount: f.amount, days: daysBetween(firstDate, f.date) }));
  const npv = (logRate: number) => timed.reduce((sum, f) => sum + f.amount * Math.exp(-logRate * f.days), 0);
  const span = Math.max(1, ...timed.map((f) => f.days));
  const bound = Math.min(XIRR_MAX_DAILY_LOG_RATE, XIRR_MAX_EXPONENT / span);

  let low = -bound;
  let high = bound;
  let npvLow = npv(low);
  const npvHigh = npv(high);
  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh) || Math.sign(npvLow) === Math.sign(npvHigh)) return null;
  for (let i = 0; i < XIRR_ITERATIONS; i += 1) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (Math.sign(npvMid) === Math.sign(npvLow)) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
    }
  }
  return Math.exp((low + high) / 2) - 1;
}

/** Rendimento money-weighted sul periodo e annuo, dai flussi e dalla durata in giorni. */
export function moneyWeightedReturn(flows: CashFlow[], days: number): { period: number; annual: number } | null {
  const daily = xirrDaily(flows);
  if (daily === null || days <= 0) return null;
  return { period: (1 + daily) ** days - 1, annual: (1 + daily) ** DAYS_PER_YEAR - 1 };
}

/** Flussi dell'investitore sul periodo: valore iniziale come versamento, valore finale come incasso. */
export function investorCashFlows(baseDate: string, baseValue: number, flows: DailyFlow[], endValue: number): CashFlow[] {
  const cashFlows: CashFlow[] = [{ date: baseDate, amount: -baseValue }];
  for (const day of flows) {
    if (day.inflow !== 0) cashFlows.push({ date: day.date, amount: -day.inflow });
    if (day.outflow + day.income !== 0) cashFlows.push({ date: day.date, amount: day.outflow + day.income });
  }
  const endDate = flows.at(-1)?.date ?? baseDate;
  cashFlows.push({ date: endDate, amount: endValue });
  return cashFlows;
}

/** Punto dell'indice mensile dei prezzi al consumo (`month` = `YYYY-MM`). */
export interface InflationPoint {
  month: string;
  value: number;
}

/** Inflazione tra il mese di `fromKey` e l'ultimo mese disponibile non oltre `toKey`, o null se non basta il dato. */
export function inflationBetween(
  points: InflationPoint[],
  fromKey: string,
  toKey: string
): { rate: number; throughMonth: string } | null {
  const fromMonth = fromKey.slice(0, 7);
  const toMonth = toKey.slice(0, 7);
  const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month));
  const start = sorted.find((p) => p.month === fromMonth);
  const end = [...sorted].reverse().find((p) => p.month <= toMonth);
  if (!start || !end || end.month <= start.month || start.value <= 0) return null;
  return { rate: end.value / start.value - 1, throughMonth: end.month };
}

/** Rendimento al netto dell'inflazione: `(1 + nominale) / (1 + inflazione) − 1`. */
export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Esito della simulazione "stessi versamenti nel benchmark". */
export interface BenchmarkSimulation {
  /** Valore di oggi del benchmark simulato, in valuta utente. */
  value: number;
  /** Rendimento del benchmark sul periodo (solo prezzo, in valuta utente). */
  twr: number;
  /** Rendimento cumulato del benchmark per ogni giorno dei flussi. */
  cumulative: { date: string; cumulative: number }[];
  /** Flussi dell'investitore con il valore finale del benchmark (per il suo rendimento money-weighted). */
  cashFlows: CashFlow[];
  /** Un prelievo ha superato il valore del benchmark simulato, che si è azzerato. */
  depleted: boolean;
}

/**
 * Simula gli stessi movimenti del portafoglio in un benchmark: a inizio periodo compra per il valore del
 * portafoglio, poi compra per le entrate e vende per uscite + proventi, al prezzo di chiusura del giorno. Così i
 * prelievi sono identici e i due valori finali si confrontano direttamente. Null se manca il prezzo di partenza.
 * `priceAt` restituisce il prezzo del benchmark in valuta utente alla data (ultimo disponibile), o null.
 */
export function simulateBenchmark(
  baseDate: string,
  baseValue: number,
  flows: DailyFlow[],
  priceAt: (dateKey: string) => number | null
): BenchmarkSimulation | null {
  const basePrice = priceAt(baseDate);
  if (basePrice === null || basePrice <= 0) return null;
  let units = baseValue / basePrice;
  let depleted = false;
  let lastPrice = basePrice;
  const cumulative: { date: string; cumulative: number }[] = [];
  for (const day of flows) {
    const price = priceAt(day.date);
    if (price === null || price <= 0) return null;
    lastPrice = price;
    units += day.inflow / price;
    const withdrawal = (day.outflow + day.income) / price;
    if (withdrawal > units + AMOUNT_EPSILON) depleted = true;
    units = Math.max(0, units - withdrawal);
    cumulative.push({ date: day.date, cumulative: price / basePrice - 1 });
  }
  const value = units * lastPrice;
  return {
    value,
    twr: lastPrice / basePrice - 1,
    cumulative,
    cashFlows: investorCashFlows(baseDate, baseValue, flows, value),
    depleted,
  };
}

/** Punto del grafico del rendimento cumulato (quote: 0,08 = +8%). */
export interface ReturnSeriesPoint {
  date: string;
  label: string;
  portfolio: number;
  benchmark: number | null;
}

/** Confronto col benchmark già pronto per la UI. */
export interface BenchmarkComparison {
  instrument: InstrumentInput;
  twr: number;
  twrAnnual: number | null;
  /** Valore di oggi con gli stessi versamenti nel benchmark. */
  simulatedValue: number;
  /** Valore reale di oggi del portafoglio, per il confronto. */
  portfolioValue: number;
  moneyWeighted: number | null;
  depleted: boolean;
}

/** Stato del benchmark quando il confronto non si può fare. */
export type BenchmarkStatus = "none" | "missing_prices" | "ok";

/** Rendimenti del portafoglio sul periodo. Le percentuali sono quote (0,08 = +8%). */
export interface PortfolioReturns {
  /** Giorno di base (il giorno prima del periodo) e ultimo giorno. */
  baseKey: string;
  toKey: string;
  days: number;
  /** Il periodo copre almeno un anno: ha senso mostrare i valori annui. */
  showAnnual: boolean;
  twr: number | null;
  twrAnnual: number | null;
  moneyWeighted: number | null;
  moneyWeightedAnnual: number | null;
  real: { value: number; inflation: number; throughMonth: string } | null;
  benchmarkStatus: BenchmarkStatus;
  benchmark: BenchmarkComparison | null;
  series: ReturnSeriesPoint[];
}

/** Prezzo di uno strumento in valuta utente alla data (ultimo disponibile), o null. */
function priceInUserCurrency(
  instrument: InstrumentInput,
  priceIndex: PriceIndex,
  fx: FxTable,
  userCurrency: string,
  dateKey: string
): number | null {
  const price = resolvePrice(priceIndex, instrument.id, dateKey);
  if (!price) return null;
  return convertAmount(fx, price.close * priceMultiplier(instrument.priceUnit), instrument.currency, userCurrency, dateKey);
}

/**
 * Rendimenti sul periodo scelto (lo stesso del grafico). `benchmark` va passato con i suoi prezzi già dentro
 * `priceIndex`; `inflation` solo quando ha senso mostrarlo (valuta EUR, periodo di almeno un anno).
 */
export function computePortfolioReturns(params: {
  transactions: InvestmentTransactionInput[];
  instruments: InstrumentInput[];
  priceIndex: PriceIndex;
  fx: FxTable;
  userCurrency: string;
  period: NetWorthPeriod;
  today: Date;
  benchmark?: InstrumentInput | null;
  inflation?: InflationPoint[] | null;
}): PortfolioReturns | null {
  const { transactions, priceIndex, fx, userCurrency, period, today, benchmark, inflation } = params;
  const fromKey = periodStartKey(transactions, period, today);
  if (fromKey === null) return null;
  const baseKey = toDateKey(addDays(parseDateOnly(fromKey), -1));
  const toKey = toDateKey(startOfDay(today));
  const points = computeDailyPortfolioValues({ ...params, fromKey: baseKey, toKey });
  const base = points[0];
  const flows = toDailyFlows(points);
  const days = daysBetween(baseKey, toKey);
  const showAnnual = days >= DAYS_PER_YEAR;
  const endValue = points.at(-1)?.value ?? 0;

  const twrSeries = computeTwrSeries(base.value, flows);
  const twr = twrSeries.at(-1)?.cumulative ?? null;
  const mwr = moneyWeightedReturn(investorCashFlows(baseKey, base.value, flows, endValue), days);

  let benchmarkStatus: BenchmarkStatus = "none";
  let comparison: BenchmarkComparison | null = null;
  let benchmarkByDate = new Map<string, number>();
  if (benchmark) {
    const simulation = simulateBenchmark(baseKey, base.value, flows, (key) =>
      priceInUserCurrency(benchmark, priceIndex, fx, userCurrency, key)
    );
    if (simulation) {
      benchmarkStatus = "ok";
      benchmarkByDate = new Map(simulation.cumulative.map((p) => [p.date, p.cumulative]));
      comparison = {
        instrument: benchmark,
        twr: simulation.twr,
        twrAnnual: showAnnual ? annualize(simulation.twr, days) : null,
        simulatedValue: simulation.value,
        portfolioValue: endValue,
        moneyWeighted: moneyWeightedReturn(simulation.cashFlows, days)?.period ?? null,
        depleted: simulation.depleted,
      };
    } else {
      benchmarkStatus = "missing_prices";
    }
  }

  const inflationRange = inflation && twr !== null ? inflationBetween(inflation, fromKey, toKey) : null;
  const series = samplePeriodSeries(
    [{ date: baseKey, cumulative: 0 }, ...twrSeries].map((p) => ({
      date: p.date,
      portfolio: p.cumulative,
      benchmark: p.date === baseKey ? (comparison ? 0 : null) : (benchmarkByDate.get(p.date) ?? null),
    })),
    period
  );

  return {
    baseKey,
    toKey,
    days,
    showAnnual,
    twr,
    twrAnnual: twr !== null && showAnnual ? annualize(twr, days) : null,
    moneyWeighted: mwr?.period ?? null,
    moneyWeightedAnnual: mwr && showAnnual ? mwr.annual : null,
    real:
      inflationRange && twr !== null
        ? { value: realReturn(twr, inflationRange.rate), inflation: inflationRange.rate, throughMonth: inflationRange.throughMonth }
        : null,
    benchmarkStatus,
    benchmark: comparison,
    series,
  };
}
