/**
 * Simulazione Monte Carlo del patrimonio (accumulo + prelievo), tutto in termini reali (potere d'acquisto di oggi).
 * Passo annuale, rendimenti lognormali con media e volatilità scelte dall'utente: è un modello, non una previsione.
 * Pura e deterministica: stesso `seed` → stessi percorsi; i percorsi sono gli stessi per ogni regola di prelievo
 * (numeri casuali comuni), così il confronto tra regole non dipende dalla fortuna.
 */

/** Regole di prelievo confrontabili. */
export type WithdrawalRule = "fissa" | "percentuale" | "guyton-klinger" | "vanguard";

export const WITHDRAWAL_RULES: WithdrawalRule[] = ["fissa", "percentuale", "guyton-klinger", "vanguard"];

/** Percorsi simulati di default: abbastanza per stabilizzare le percentuali a ±1 punto circa. */
export const DEFAULT_PATHS = 3000;
export const MAX_PATHS = 10000;
/** Guardrail di Guyton-Klinger (versione semplificata): bande ±20% sul tasso iniziale, aggiustamenti del 10%. */
export const GK_BAND = 0.2;
export const GK_ADJUSTMENT = 0.1;
/** Con meno anni di questi all'orizzonte la regola di taglio di GK non si applica. */
export const GK_NO_CUT_LAST_YEARS = 15;
/** Vanguard dynamic spending: tetto di aumento e di taglio annuo rispetto al prelievo precedente. */
export const VANGUARD_CEILING = 0.05;
export const VANGUARD_FLOOR = 0.025;

/** Pensione pubblica: importo annuo reale che riduce il prelievo dal portafoglio dopo `startsAfterYears` anni di pensionamento. */
export interface PublicPensionOffset {
  annual: number;
  startsAfterYears: number;
}

export interface MonteCarloInput {
  startingWealth: number;
  /** Risparmio annuo (reale) durante l'accumulo, versato a fine anno. */
  annualSavings: number;
  accumulationYears: number;
  retirementYears: number;
  /** Spesa annua reale da coprire in pensione. */
  annualSpending: number;
  /** Rendimento reale atteso annuo (media aritmetica, es. 0.04). */
  expectedReturn: number;
  /** Volatilità annua dei rendimenti (deviazione standard, es. 0.15). */
  volatility: number;
  /** Inflazione attesa: usata solo da Guyton-Klinger ("salta l'inflazione dopo un anno negativo"). */
  inflation?: number;
  rule: WithdrawalRule;
  publicPension?: PublicPensionOffset;
  paths?: number;
  seed?: number;
}

export interface WealthBand {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface SpendingBand {
  /** Anno di pensionamento (0 = primo). */
  year: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloResult {
  rule: WithdrawalRule;
  paths: number;
  /** Quota di percorsi in cui il patrimonio non si esaurisce entro l'orizzonte (0-1). */
  successRate: number;
  /** Patrimonio per anno (0 = oggi) lungo accumulo + pensione. */
  wealth: WealthBand[];
  /** Quota cumulata di percorsi esauriti, per anno di pensionamento (indice 0 = fine del primo anno). */
  ruinByYear: number[];
  /** Spesa effettivamente sostenuta per anno di pensionamento (include la pensione pubblica). */
  spending: SpendingBand[];
  /** Patrimonio finale: percentili sui percorsi. */
  endingWealth: { p10: number; p50: number; p90: number };
  /** Taglio massimo della spesa rispetto al primo anno: mediana e 90° percentile sui percorsi (0-1). */
  maxCut: { median: number; p90: number };
}

/** Generatore pseudo-casuale 32 bit (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normale standard (Box-Muller) a partire da un generatore uniforme. */
export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), Number.EPSILON);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Percentile (0-100) con interpolazione lineare su un array già ordinato. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const pos = (Math.min(Math.max(p, 0), 100) / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function pathSeed(seed: number, index: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(index + 1, 0xc2b2ae35)) >>> 0;
}

/** Parametri della lognormale con media aritmetica `1 + r` e deviazione `sigma`. */
export function lognormalParams(expectedReturn: number, volatility: number): { mu: number; sd: number } {
  const mean = 1 + expectedReturn;
  const variance = Math.log(1 + (volatility / mean) ** 2);
  return { mu: Math.log(mean) - variance / 2, sd: Math.sqrt(variance) };
}

function sortedColumn(values: Float64Array, count: number): number[] {
  return Array.from(values.subarray(0, count)).sort((a, b) => a - b);
}

/** Esegue la simulazione. `retirementYears` e `accumulationYears` sono arrotondati a interi non negativi. */
export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const paths = Math.min(Math.max(Math.round(input.paths ?? DEFAULT_PATHS), 1), MAX_PATHS);
  const seed = input.seed ?? 1;
  const accum = Math.max(0, Math.round(input.accumulationYears));
  const ret = Math.max(1, Math.round(input.retirementYears));
  const inflation = input.inflation ?? 0.02;
  const { mu, sd } = lognormalParams(input.expectedReturn, input.volatility);
  const pension = input.publicPension && input.publicPension.annual > 0 ? input.publicPension : null;
  const pensionStart = pension ? Math.max(0, Math.round(pension.startsAfterYears)) : Infinity;

  const total = accum + ret;
  const wealthCols = Array.from({ length: total + 1 }, () => new Float64Array(paths));
  const spendCols = Array.from({ length: ret }, () => new Float64Array(paths));
  const ruinCounts = new Array<number>(ret).fill(0);
  const endings = new Float64Array(paths);
  const cuts = new Float64Array(paths);
  let successes = 0;

  for (let i = 0; i < paths; i++) {
    const rand = mulberry32(pathSeed(seed, i));
    let wealth = input.startingWealth;
    wealthCols[0][i] = wealth;
    for (let y = 0; y < accum; y++) {
      wealth = Math.max(0, wealth * Math.exp(mu + sd * gaussian(rand)) + input.annualSavings);
      wealthCols[y + 1][i] = wealth;
    }

    const retirementWealth = wealth;
    const need0 = Math.max(0, input.annualSpending - (pensionStart === 0 ? pension!.annual : 0));
    const rate0 = retirementWealth > 0 ? need0 / retirementWealth : 0;
    let prev = need0;
    let rate = rate0;
    let lastReturn = 0;
    let ruined = false;
    let minSpend = input.annualSpending;

    for (let k = 0; k < ret; k++) {
      const pensionNow = k >= pensionStart ? pension!.annual : 0;
      const remaining = ret - k;
      let withdrawal: number;
      if (k > 0 && k === pensionStart) {
        // La pensione pubblica abbassa il bisogno: la regola riparte dal nuovo livello.
        const rebased = Math.max(0, prev - pension!.annual);
        if (prev > 0) rate *= rebased / prev;
        prev = rebased;
      }
      if (ruined || wealth <= 0) {
        withdrawal = 0;
      } else if (input.rule === "fissa") {
        withdrawal = Math.max(0, input.annualSpending - pensionNow);
      } else if (input.rule === "percentuale") {
        withdrawal = rate * wealth;
      } else if (input.rule === "guyton-klinger") {
        withdrawal = k === 0 ? need0 : lastReturn < 0 && prev / wealth > rate0 ? prev / (1 + inflation) : prev;
        const current = withdrawal / wealth;
        if (current > rate0 * (1 + GK_BAND) && remaining > GK_NO_CUT_LAST_YEARS) withdrawal *= 1 - GK_ADJUSTMENT;
        else if (current < rate0 * (1 - GK_BAND)) withdrawal *= 1 + GK_ADJUSTMENT;
      } else {
        const target = rate0 * wealth;
        withdrawal = k === 0 ? need0 : Math.min(Math.max(target, prev * (1 - VANGUARD_FLOOR)), prev * (1 + VANGUARD_CEILING));
      }
      withdrawal = Math.min(withdrawal, wealth);
      prev = withdrawal;

      const spent = withdrawal + pensionNow;
      spendCols[k][i] = spent;
      minSpend = Math.min(minSpend, spent);

      wealth -= withdrawal;
      const growth = Math.exp(mu + sd * gaussian(rand));
      lastReturn = growth - 1;
      wealth *= growth;
      if (!ruined && (wealth <= 0 || (input.rule === "fissa" && withdrawal < input.annualSpending - pensionNow - 1e-9))) {
        ruined = true;
        for (let r = k; r < ret; r++) ruinCounts[r]++;
      }
      if (ruined) wealth = 0;
      wealthCols[accum + k + 1][i] = wealth;
    }

    const firstSpend = spendCols[0][i];
    cuts[i] = firstSpend > 0 ? Math.max(0, 1 - minSpend / Math.max(firstSpend, input.annualSpending)) : 1;
    endings[i] = wealth;
    if (!ruined) successes++;
  }

  const wealthBands: WealthBand[] = wealthCols.map((col, year) => {
    const s = sortedColumn(col, paths);
    return { year, p10: percentile(s, 10), p25: percentile(s, 25), p50: percentile(s, 50), p75: percentile(s, 75), p90: percentile(s, 90) };
  });
  const spending: SpendingBand[] = spendCols.map((col, year) => {
    const s = sortedColumn(col, paths);
    return { year, p10: percentile(s, 10), p50: percentile(s, 50), p90: percentile(s, 90) };
  });
  const endSorted = sortedColumn(endings, paths);
  const cutSorted = sortedColumn(cuts, paths);

  return {
    rule: input.rule,
    paths,
    successRate: successes / paths,
    wealth: wealthBands,
    ruinByYear: ruinCounts.map((c) => c / paths),
    spending,
    endingWealth: { p10: percentile(endSorted, 10), p50: percentile(endSorted, 50), p90: percentile(endSorted, 90) },
    maxCut: { median: percentile(cutSorted, 50), p90: percentile(cutSorted, 90) },
  };
}

/** Confronta tutte le regole sugli stessi percorsi (stesso seed). */
export function compareRules(input: Omit<MonteCarloInput, "rule">): MonteCarloResult[] {
  return WITHDRAWAL_RULES.map((rule) => runMonteCarlo({ ...input, rule }));
}
