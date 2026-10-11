/**
 * Indicatori fondamentali di un titolo calcolati dall'app (pagina titolo): multipli di valutazione con la forbice
 * degli ultimi esercizi, valori per azione, conti, margini, redditività, solidità, dividendi; per ETF e fondi
 * rendimenti anno per anno e costo del TER. Tutto puro: riceve bilanci, chiusure e dividendi già caricati.
 * Ogni indicatore porta con sé numeratore e denominatore, così la pagina può mostrare il calcolo con i numeri veri.
 */

import type { CompanyStatements, StatementPeriod } from "@/lib/market-data/statements";
import { closeOnOrBefore, type CloseInput } from "./title-stats";

/** Unità di un operando: importo totale, importo per azione, prezzo di borsa, numero di azioni. */
export type OperandUnit = "money" | "perShare" | "price" | "shares";

export interface Operand {
  label: string;
  value: number;
  unit: OperandUnit;
}

/** Forbice di un multiplo negli esercizi passati, calcolata con la chiusura del giorno di fine esercizio. */
export interface IndicatorRange {
  min: number;
  max: number;
  average: number;
  /** Esercizi su cui è calcolata. */
  years: number;
}

/** Un indicatore calcolato: valore, i due termini della divisione e, per i multipli, la forbice storica. */
export interface Indicator {
  value: number;
  numerator: Operand;
  denominator: Operand;
  history?: IndicatorRange | null;
}

export const VALUATION_KEYS = ["pe", "ps", "pb", "pfcf", "evEbitda", "earningsYield"] as const;
export type ValuationKey = (typeof VALUATION_KEYS)[number];
export const PER_SHARE_KEYS = ["revenue", "eps", "fcf", "book", "dividend"] as const;
export type PerShareKey = (typeof PER_SHARE_KEYS)[number];
export const MARGIN_KEYS = ["gross", "operating", "net"] as const;
export type MarginKey = (typeof MARGIN_KEYS)[number];
export const PROFITABILITY_KEYS = ["roe", "roa", "roic", "interestCoverage"] as const;
export type ProfitabilityKey = (typeof PROFITABILITY_KEYS)[number];
export const SOLIDITY_KEYS = ["debtToEquity", "netDebtToEbitda", "currentRatio", "payout"] as const;
export type SolidityKey = (typeof SOLIDITY_KEYS)[number];

/** Colonna delle tabelle per esercizio: un anno o gli ultimi 12 mesi. */
export interface StatementColumn {
  label: string;
  end: string;
  trailing: boolean;
}

export interface StockFundamentals {
  /** Valuta di bilancio: quella di valori per azione e conti. */
  currency: string;
  /** False se la valuta di bilancio è diversa da quella di quotazione: i multipli col prezzo non si calcolano. */
  priceComparable: boolean;
  /** Data di chiusura dei dati più recenti usati (ultimi 12 mesi o ultimo esercizio). */
  latestEnd: string;
  columns: StatementColumn[];
  valuation: Partial<Record<ValuationKey, Indicator>>;
  perShare: Record<PerShareKey, (number | null)[]>;
  company: { revenue: (number | null)[]; netIncome: (number | null)[]; freeCashFlow: (number | null)[] };
  margins: Partial<Record<MarginKey, Indicator>>;
  /** Crescita dei ricavi nell'ultimo esercizio e media annua composta sugli esercizi disponibili. */
  growth: { lastYear: number | null; average: number | null; averageYears: number };
  profitability: Partial<Record<ProfitabilityKey, Indicator>>;
  solidity: Partial<Record<SolidityKey, Indicator>>;
}

/** Esercizi minimi perché la forbice storica di un multiplo abbia senso. */
export const MIN_RANGE_YEARS = 3;
/** Quanto indietro può stare la chiusura del giorno di fine esercizio (weekend, festivi). */
const YEAR_END_TOLERANCE_DAYS = 10;

function shiftDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function priceAt(closes: CloseInput[], dateKey: string): number | null {
  const close = closeOnOrBefore(closes, dateKey);
  if (!close || close.close <= 0 || close.date < shiftDays(dateKey, -YEAR_END_TOLERANCE_DAYS)) return null;
  return close.close;
}

/** Divisione solo con denominatore valido (e, se richiesto, positivo): altrimenti nessun indicatore. */
function ratio(numerator: Operand, denominator: Operand, opts: { positiveDenominator?: boolean; positiveNumerator?: boolean } = {}): Indicator | null {
  if (!Number.isFinite(numerator.value) || !Number.isFinite(denominator.value) || denominator.value === 0) return null;
  if (opts.positiveDenominator && denominator.value <= 0) return null;
  if (opts.positiveNumerator && numerator.value <= 0) return null;
  return { value: numerator.value / denominator.value, numerator, denominator };
}

/** Grandezze derivate di un periodo, comuni a valori per azione, multipli e indicatori. */
interface PeriodFigures {
  shares: number | null;
  sharesOutstanding: number | null;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  fcf: number | null;
  equity: number | null;
  ebitda: number | null;
  totalDebt: number | null;
  cash: number | null;
  dividendsPaid: number | null;
}

function figures(period: StatementPeriod): PeriodFigures {
  const v = period.values;
  const shares = v.dilutedShares ?? v.sharesOutstanding ?? null;
  const eps = v.dilutedEps ?? (v.netIncome !== undefined && shares ? v.netIncome / shares : null);
  const fcf = v.freeCashFlow ?? (v.operatingCashFlow !== undefined && v.capex !== undefined ? v.operatingCashFlow + v.capex : null);
  return {
    shares: shares && shares > 0 ? shares : null,
    sharesOutstanding: v.sharesOutstanding ?? shares ?? null,
    revenue: v.revenue ?? null,
    netIncome: v.netIncome ?? null,
    eps,
    fcf,
    equity: v.equity ?? null,
    ebitda: v.ebitda ?? null,
    totalDebt: v.totalDebt ?? null,
    cash: v.cash ?? null,
    dividendsPaid: v.dividendsPaid !== undefined ? Math.abs(v.dividendsPaid) : null,
  };
}

function perShareValues(f: PeriodFigures): Record<PerShareKey, number | null> {
  const per = (total: number | null, shares: number | null) => (total !== null && shares ? total / shares : null);
  return {
    revenue: per(f.revenue, f.shares),
    eps: f.eps,
    fcf: per(f.fcf, f.shares),
    book: per(f.equity, f.sharesOutstanding),
    dividend: per(f.dividendsPaid, f.shares),
  };
}

/** Multipli di un periodo a un dato prezzo. */
function valuationAt(price: number, f: PeriodFigures): Partial<Record<ValuationKey, Indicator>> {
  const ps = perShareValues(f);
  const p: Operand = { label: "Prezzo", value: price, unit: "price" };
  const out: Partial<Record<ValuationKey, Indicator | null>> = {};
  if (ps.eps !== null) {
    out.pe = ratio(p, { label: "Utile per azione", value: ps.eps, unit: "perShare" }, { positiveDenominator: true });
    out.earningsYield = ratio({ label: "Utile per azione", value: ps.eps, unit: "perShare" }, p);
  }
  if (ps.revenue !== null) out.ps = ratio(p, { label: "Ricavi per azione", value: ps.revenue, unit: "perShare" }, { positiveDenominator: true });
  if (ps.book !== null) out.pb = ratio(p, { label: "Patrimonio per azione", value: ps.book, unit: "perShare" }, { positiveDenominator: true });
  if (ps.fcf !== null) out.pfcf = ratio(p, { label: "Cassa libera per azione", value: ps.fcf, unit: "perShare" }, { positiveDenominator: true });
  if (f.ebitda !== null && f.sharesOutstanding && f.totalDebt !== null) {
    const ev = price * f.sharesOutstanding + f.totalDebt - (f.cash ?? 0);
    out.evEbitda = ratio({ label: "Valore d'impresa", value: ev, unit: "money" }, { label: "EBITDA", value: f.ebitda, unit: "money" }, { positiveDenominator: true, positiveNumerator: true });
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as Partial<Record<ValuationKey, Indicator>>;
}

function range(values: number[]): IndicatorRange | null {
  if (values.length < MIN_RANGE_YEARS) return null;
  return { min: Math.min(...values), max: Math.max(...values), average: values.reduce((a, b) => a + b, 0) / values.length, years: values.length };
}

function money(label: string, value: number | null | undefined): Operand | null {
  return value === null || value === undefined ? null : { label, value, unit: "money" };
}

function pair(n: Operand | null, d: Operand | null, opts?: Parameters<typeof ratio>[2]): Indicator | null {
  return n && d ? ratio(n, d, opts) : null;
}

function compact<K extends string>(entries: [K, Indicator | null][]): Partial<Record<K, Indicator>> {
  return Object.fromEntries(entries.filter(([, v]) => v !== null)) as Partial<Record<K, Indicator>>;
}

/**
 * Indicatori di un'azione dai bilanci. `closes` in ordine di data crescente (servono per la forbice storica dei
 * multipli); `quoteCurrency` è la valuta di quotazione: se diversa da quella di bilancio i multipli col prezzo restano vuoti.
 */
export function computeStockFundamentals(statements: CompanyStatements, closes: CloseInput[], quoteCurrency: string): StockFundamentals | null {
  if (statements.annual.length === 0) return null;
  const currency = statements.currency ?? quoteCurrency;
  const priceComparable = currency === quoteCurrency;
  const periods: StatementPeriod[] = [...statements.annual];
  if (statements.trailing && statements.trailing.end > periods[periods.length - 1].end) periods.push(statements.trailing);
  const columns: StatementColumn[] = periods.map((p) => {
    const trailing = p === statements.trailing;
    return { label: trailing ? "12 mesi" : p.end.slice(0, 4), end: p.end, trailing };
  });
  const allFigures = periods.map(figures);
  const latest = allFigures[allFigures.length - 1];
  const latestPeriod = periods[periods.length - 1];

  const perShare = Object.fromEntries(PER_SHARE_KEYS.map((k) => [k, allFigures.map((f) => perShareValues(f)[k])])) as Record<PerShareKey, (number | null)[]>;

  let valuation: Partial<Record<ValuationKey, Indicator>> = {};
  const lastClose = closes.length > 0 ? closes[closes.length - 1].close : null;
  if (priceComparable && lastClose !== null && lastClose > 0) {
    valuation = valuationAt(lastClose, latest);
    const history = statements.annual.map((p) => {
      const price = priceAt(closes, p.end);
      return price === null ? {} : valuationAt(price, figures(p));
    });
    for (const key of VALUATION_KEYS) {
      const indicator = valuation[key];
      if (indicator && key !== "earningsYield") indicator.history = range(history.map((h) => h[key]?.value).filter((v): v is number => v !== undefined));
    }
  }

  const v = latestPeriod.values;
  const revenue = money("Ricavi", v.revenue);
  const margins = compact<MarginKey>([
    ["gross", pair(money("Utile lordo", v.grossProfit), revenue, { positiveDenominator: true })],
    ["operating", pair(money("Utile operativo", v.operatingIncome), revenue, { positiveDenominator: true })],
    ["net", pair(money("Utile netto", v.netIncome), revenue, { positiveDenominator: true })],
  ]);

  const revenues = statements.annual.map((p) => p.values.revenue ?? null);
  const last = revenues[revenues.length - 1];
  const previous = revenues.length > 1 ? revenues[revenues.length - 2] : null;
  const firstIndex = revenues.findIndex((r) => r !== null && r > 0);
  const averageYears = firstIndex >= 0 ? revenues.length - 1 - firstIndex : 0;
  const growth = {
    lastYear: last !== null && previous !== null && previous > 0 ? last / previous - 1 : null,
    average: averageYears >= MIN_RANGE_YEARS - 1 && last !== null && last > 0 ? (last / revenues[firstIndex]!) ** (1 / averageYears) - 1 : null,
    averageYears,
  };

  const equity = money("Patrimonio netto", v.equity);
  const investedValue = v.equity !== undefined && v.totalDebt !== undefined ? v.equity + v.totalDebt - (v.cash ?? 0) : null;
  const profitability = compact<ProfitabilityKey>([
    ["roe", pair(money("Utile netto", v.netIncome), equity, { positiveDenominator: true })],
    ["roa", pair(money("Utile netto", v.netIncome), money("Totale attivo", v.totalAssets), { positiveDenominator: true })],
    ["roic", pair(money("Utile operativo", v.operatingIncome), money("Capitale investito", investedValue), { positiveDenominator: true })],
    [
      "interestCoverage",
      pair(money("Utile operativo", v.operatingIncome), money("Interessi passivi", v.interestExpense !== undefined ? Math.abs(v.interestExpense) : null), { positiveDenominator: true }),
    ],
  ]);
  const netDebt = v.totalDebt !== undefined ? v.totalDebt - (v.cash ?? 0) : null;
  const solidity = compact<SolidityKey>([
    ["debtToEquity", pair(money("Debiti finanziari", v.totalDebt), equity, { positiveDenominator: true })],
    ["netDebtToEbitda", pair(money("Debito netto", netDebt), money("EBITDA", v.ebitda), { positiveDenominator: true })],
    ["currentRatio", pair(money("Attività a breve", v.currentAssets), money("Passività a breve", v.currentLiabilities), { positiveDenominator: true })],
    ["payout", pair(money("Dividendi pagati", latest.dividendsPaid), money("Utile netto", v.netIncome), { positiveDenominator: true })],
  ]);

  return {
    currency,
    priceComparable,
    latestEnd: latestPeriod.end,
    columns,
    valuation,
    perShare,
    company: {
      revenue: allFigures.map((f) => f.revenue),
      netIncome: allFigures.map((f) => f.netIncome),
      freeCashFlow: allFigures.map((f) => f.fcf),
    },
    margins,
    growth,
    profitability,
    solidity,
  };
}

/** Dividendo per quota con data di stacco, nella valuta di quotazione. */
export interface DividendInput {
  exDate: string;
  amount: number;
}

export interface DividendFacts {
  /** Somma per anno solare degli ultimi anni (l'anno in corso è parziale). */
  perYear: { year: number; amount: number; partial: boolean }[];
  /** Dividendi per quota con stacco negli ultimi 12 mesi. */
  trailing: number;
  yieldToday: number | null;
  /** Stessi dividendi diviso il prezzo medio di carico dell'utente. */
  yieldOnCost: number | null;
  /** Crescita media annua composta tra anni interi, o null con meno di 3 anni. */
  growth: number | null;
  growthYears: number;
  /** Prossimo stacco annunciato (dopo oggi), o null. */
  nextExDate: string | null;
}

/** Anni solari mostrati nello storico dei dividendi (anno in corso compreso). */
export const DIVIDEND_YEARS = 6;

/** Fatti sui dividendi per quota di un titolo, o null se non ne ha mai staccati. */
export function computeDividendFacts(params: {
  dividends: DividendInput[];
  lastClose: number | null;
  averagePrice: number | null;
  announcedExDate: string | null;
  today: string;
}): DividendFacts | null {
  const { dividends, lastClose, averagePrice, announcedExDate, today } = params;
  const past = dividends.filter((d) => d.exDate <= today && d.amount > 0);
  if (past.length === 0) return null;
  const thisYear = Number(today.slice(0, 4));
  const byYear = new Map<number, number>();
  for (const d of past) {
    const year = Number(d.exDate.slice(0, 4));
    byYear.set(year, (byYear.get(year) ?? 0) + d.amount);
  }
  const firstYear = Math.max(Math.min(...byYear.keys()), thisYear - DIVIDEND_YEARS + 1);
  const perYear: DividendFacts["perYear"] = [];
  for (let year = firstYear; year <= thisYear; year += 1) perYear.push({ year, amount: byYear.get(year) ?? 0, partial: year === thisYear });

  const yearAgo = shiftDays(today, -365);
  const trailing = past.filter((d) => d.exDate > yearAgo).reduce((sum, d) => sum + d.amount, 0);
  const complete = perYear.filter((y) => !y.partial);
  const firstPaid = complete.findIndex((y) => y.amount > 0);
  const growthYears = firstPaid >= 0 ? complete.length - 1 - firstPaid : 0;
  const lastComplete = complete[complete.length - 1]?.amount ?? 0;
  const growth = growthYears >= MIN_RANGE_YEARS - 1 && lastComplete > 0 ? (lastComplete / complete[firstPaid].amount) ** (1 / growthYears) - 1 : null;

  return {
    perYear,
    trailing,
    yieldToday: lastClose && lastClose > 0 && trailing > 0 ? trailing / lastClose : null,
    yieldOnCost: averagePrice && averagePrice > 0 && trailing > 0 ? trailing / averagePrice : null,
    growth,
    growthYears,
    nextExDate: announcedExDate && announcedExDate > today ? announcedExDate : null,
  };
}

/** Rendimento di prezzo di un anno solare (l'anno in corso fino all'ultima chiusura). */
export interface AnnualReturn {
  year: number;
  value: number;
  partial: boolean;
}

/** Rendimenti anno per anno dalle chiusure (crescenti per data); un anno compare solo se c'è la chiusura di fine anno precedente. */
export function computeAnnualReturns(closes: CloseInput[]): AnnualReturn[] {
  if (closes.length < 2) return [];
  const last = closes[closes.length - 1];
  const lastYear = Number(last.date.slice(0, 4));
  const firstYear = Number(closes[0].date.slice(0, 4));
  const out: AnnualReturn[] = [];
  for (let year = firstYear + 1; year <= lastYear; year += 1) {
    const start = priceAt(closes, `${year - 1}-12-31`);
    const partial = year === lastYear;
    const end = partial ? last.close : priceAt(closes, `${year}-12-31`);
    if (start !== null && end !== null) out.push({ year, value: end / start - 1, partial });
  }
  return out;
}

/** Rendimento annuo ipotetico usato per mostrare l'effetto del TER nel tempo. */
export const TER_EXAMPLE_RETURN = 0.05;
export const TER_EXAMPLE_AMOUNT = 10_000;
export const TER_EXAMPLE_YEARS = [10, 20] as const;

/** Quanto si perde in `years` anni su `amount` per un costo annuo `ter`, rispetto allo stesso fondo senza costi. */
export function terCost(ter: number, years: number, amount = TER_EXAMPLE_AMOUNT, annualReturn = TER_EXAMPLE_RETURN): number {
  return amount * ((1 + annualReturn) ** years - ((1 + annualReturn) * (1 - ter)) ** years);
}
