/**
 * Motore di calcolo della previdenza complementare (fondo pensione / PIP con solo TFR o versamenti periodici).
 *
 * L'utente inserisce "fotografie" del fondo (data, contributi netti, controvalore): da lì si ricavano i versamenti
 * (differenza dei contributi netti tra due fotografie), il rendimento ponderato per i tempi, una stima del netto in
 * caso di prelievo e le proiezioni. Funzioni pure, nessuna dipendenza da DB o UI.
 *
 * Tutti i parametri fiscali stanno in `PENSION_TAX_RULES` con anno di validità e fonte: sono regole da far validare
 * da un professionista prima di un rilascio e cambiano nel tempo.
 */

import { daysBetween, moneyWeightedReturn, type CashFlow } from "./returns";

/** Parametri fiscali e di legge usati dai calcoli. Fonte: COVIP, MEFOP (2026-10-01); da validare con un professionista. */
export const PENSION_TAX_RULES = {
  validFromYear: 2026,
  /** Aliquota sulle prestazioni per i contributi versati dal 2007. */
  exitBaseRate: 0.15,
  /** Anni di partecipazione dopo i quali l'aliquota comincia a scendere. */
  exitReductionAfterYears: 15,
  /** Riduzione dell'aliquota per ogni anno oltre il quindicesimo (0,30 punti percentuali). */
  exitReductionPerYear: 0.003,
  exitMinRate: 0.09,
  /** Riscatto per cause diverse da quelle previste dalla norma, e anticipazioni per altri motivi. */
  exitOtherReasonsRate: 0.23,
  /** Rivalutazione annua del TFR in azienda: quota fissa e quota dell'inflazione (valori a memoria, da verificare). */
  companyTfrFixedRate: 0.015,
  companyTfrInflationShare: 0.75,
  /** Imposta sostitutiva sulla rivalutazione del TFR in azienda (valore a memoria, da verificare). */
  companyTfrRevaluationTax: 0.17,
} as const;

/** Mesi tra due versamenti del TFR nel fondo (di norma trimestrale). */
export const TFR_PAYMENT_MONTHS = 3;
/** Giorni minimi di storico per stimare il versamento periodico dalle fotografie. */
const MIN_DAYS_FOR_CONTRIBUTION_ESTIMATE = 270;
const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;
const QUARTERS_PER_YEAR = 4;
const MS_PER_DAY = 86_400_000;

/** Fotografia del fondo: ciò che l'utente legge nell'area clienti in un certo giorno. */
export interface PensionSnapshot {
  id: string;
  /** Data della lettura, `YYYY-MM-DD`. */
  date: string;
  /** Totale dei contributi netti versati fino a quel giorno. */
  netContributions: number;
  /** Controvalore (valore di mercato) del fondo quel giorno. */
  value: number;
}

const toUtc = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Aggiunge `months` mesi a una data `YYYY-MM-DD` (il giorno si accorcia se il mese di arrivo è più corto). */
export function addMonths(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const total = y * MONTHS_PER_YEAR + (m - 1) + months;
  const year = Math.floor(total / MONTHS_PER_YEAR);
  const month = total % MONTHS_PER_YEAR;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toKey(Date.UTC(year, month, Math.min(d, lastDay)));
}

/** Anni interi tra due date. */
export function wholeYearsBetween(fromKey: string, toKeyValue: string): number {
  let years = Number(toKeyValue.slice(0, 4)) - Number(fromKey.slice(0, 4));
  if (toKeyValue.slice(5) < fromKey.slice(5)) years -= 1;
  return Math.max(0, years);
}

/** Snapshot ordinati per data, senza modificare l'originale. */
export function sortSnapshots(snapshots: PensionSnapshot[]): PensionSnapshot[] {
  return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
}

/** Versamenti ricavati dalle fotografie: differenza dei contributi netti, datata alla fotografia che li mostra. */
export interface DerivedContribution {
  date: string;
  amount: number;
  /** Vero per i versamenti del passato spalmati tra l'adesione e la prima fotografia (non letti dal grafico). */
  estimated: boolean;
}

/**
 * Versamenti dedotti dalle fotografie. I contributi già presenti alla prima fotografia vengono distribuiti in modo
 * uniforme a scadenze trimestrali tra la data di adesione e la prima fotografia (stima, marcata `estimated`).
 */
export function deriveContributions(snapshots: PensionSnapshot[], adhesionDate: string | null): DerivedContribution[] {
  const sorted = sortSnapshots(snapshots);
  if (sorted.length === 0) return [];
  const first = sorted[0];
  const result: DerivedContribution[] = [];
  if (first.netContributions > 0) {
    const start = adhesionDate && adhesionDate < first.date ? adhesionDate : null;
    if (start) {
      const months = Math.max(1, Math.round(daysBetween(start, first.date) / (DAYS_PER_YEAR / MONTHS_PER_YEAR)));
      const payments = Math.max(1, Math.round(months / TFR_PAYMENT_MONTHS));
      const spanMs = toUtc(first.date) - toUtc(start);
      for (let k = 1; k <= payments; k += 1) {
        result.push({ date: toKey(toUtc(start) + Math.round((spanMs * k) / payments)), amount: first.netContributions / payments, estimated: true });
      }
    } else {
      result.push({ date: first.date, amount: first.netContributions, estimated: false });
    }
  }
  for (let i = 1; i < sorted.length; i += 1) {
    const delta = sorted[i].netContributions - sorted[i - 1].netContributions;
    if (Math.abs(delta) > 0.005) result.push({ date: sorted[i].date, amount: delta, estimated: false });
  }
  return result;
}

/** Rendimento del fondo calcolato dalle fotografie. */
export interface PensionPerformance {
  value: number;
  netContributions: number;
  /** Controvalore meno contributi netti. */
  gain: number;
  /** Guadagno diviso contributi netti, o null senza contributi. */
  gainPct: number | null;
  /** Rendimento annuo ponderato per i tempi (XIRR), o null se non calcolabile. */
  annualReturn: number | null;
  /** Vero se nel calcolo ci sono versamenti stimati (storico precedente alla prima fotografia). */
  approximate: boolean;
  firstDate: string;
  lastDate: string;
}

/** Rendimento e guadagno dalle fotografie; null senza fotografie. */
export function computePensionPerformance(snapshots: PensionSnapshot[], adhesionDate: string | null): PensionPerformance | null {
  const sorted = sortSnapshots(snapshots);
  const last = sorted.at(-1);
  if (!last) return null;
  const contributions = deriveContributions(sorted, adhesionDate);
  const flows: CashFlow[] = contributions.map((c) => ({ date: c.date, amount: -c.amount }));
  flows.push({ date: last.date, amount: last.value });
  const firstDate = contributions[0]?.date ?? sorted[0].date;
  const days = daysBetween(firstDate, last.date);
  const mwr = moneyWeightedReturn(flows, days);
  const gain = last.value - last.netContributions;
  return {
    value: last.value,
    netContributions: last.netContributions,
    gain,
    gainPct: last.netContributions > 0 ? gain / last.netContributions : null,
    annualReturn: mwr ? mwr.annual : null,
    approximate: contributions.some((c) => c.estimated),
    firstDate,
    lastDate: last.date,
  };
}

/** Aliquota sulle prestazioni (contributi dal 2007) dopo `years` anni di partecipazione. */
export function exitTaxRate(years: number): number {
  const r = PENSION_TAX_RULES;
  const reduction = Math.max(0, years - r.exitReductionAfterYears) * r.exitReductionPerYear;
  return Math.max(r.exitMinRate, r.exitBaseRate - reduction);
}

/** Quando l'aliquota comincia a scendere e quando arriva al minimo, dalla data di prima adesione. */
export function exitTaxMilestones(adhesionDate: string): { reductionStartsOn: string; minRateOn: string } {
  const r = PENSION_TAX_RULES;
  const yearsToMin = r.exitReductionAfterYears + Math.round((r.exitBaseRate - r.exitMinRate) / r.exitReductionPerYear);
  return {
    reductionStartsOn: addMonths(adhesionDate, r.exitReductionAfterYears * MONTHS_PER_YEAR),
    minRateOn: addMonths(adhesionDate, yearsToMin * MONTHS_PER_YEAR),
  };
}

export type WithdrawalReason = "pensionamento" | "sanitarie" | "altri";

/** Stima del netto in un'ipotesi di prelievo: forbice tra imposta sui soli contributi e imposta su tutto il valore. */
export interface WithdrawalScenario {
  reason: WithdrawalReason;
  rate: number;
  /** Netto prudente: imposta sull'intero controvalore. */
  netLow: number;
  /** Netto atteso: imposta sui soli contributi (i rendimenti hanno già pagato il 20% in accumulo). Da validare. */
  netHigh: number;
}

/**
 * Netto stimato se si prelevasse oggi, in tre ipotesi. Non tiene conto di limiti di legge sulle ipotesi di
 * prelievo, di eventuali costi di uscita del prodotto né della quota che alla pensione va in rendita.
 */
export function withdrawalScenarios(value: number, netContributions: number, adhesionDate: string | null, today: string): WithdrawalScenario[] {
  const years = adhesionDate ? wholeYearsBetween(adhesionDate, today) : 0;
  const reduced = exitTaxRate(years);
  const base = Math.min(value, Math.max(0, netContributions));
  const make = (reason: WithdrawalReason, rate: number): WithdrawalScenario => ({
    reason,
    rate,
    netLow: value - rate * Math.max(0, value),
    netHigh: value - rate * base,
  });
  return [
    make("pensionamento", reduced),
    make("sanitarie", reduced),
    make("altri", PENSION_TAX_RULES.exitOtherReasonsRate),
  ];
}

/** Quanto varrebbero gli stessi versamenti se il TFR fosse rimasto in azienda, rivalutato per legge. */
export interface CompanyTfrComparison {
  /** Valore con la rivalutazione al lordo dell'imposta sostitutiva. */
  gross: number;
  /** Valore al netto dell'imposta sostitutiva sulla rivalutazione (non include la tassazione all'uscita). */
  net: number;
  /** Tasso annuo di rivalutazione usato. */
  annualRate: number;
}

/** Valore dei versamenti se fossero rimasti in azienda, con inflazione annua costante `inflationRate` (ipotesi). */
export function companyTfrValue(contributions: DerivedContribution[], asOf: string, inflationRate: number): CompanyTfrComparison {
  const r = PENSION_TAX_RULES;
  const annualRate = r.companyTfrFixedRate + r.companyTfrInflationShare * inflationRate;
  let gross = 0;
  let net = 0;
  for (const c of contributions) {
    const years = Math.max(0, daysBetween(c.date, asOf)) / DAYS_PER_YEAR;
    const grown = c.amount * (1 + annualRate) ** years;
    gross += grown;
    net += c.amount + (grown - c.amount) * (1 - r.companyTfrRevaluationTax);
  }
  return { gross, net, annualRate };
}

/** Versamento medio per trimestre degli ultimi 12 mesi di fotografie, o null con meno di ~9 mesi di storico. */
export function recentQuarterlyContribution(snapshots: PensionSnapshot[]): number | null {
  const sorted = sortSnapshots(snapshots);
  const last = sorted.at(-1);
  if (!last || sorted.length < 2) return null;
  const windowStart = toKey(toUtc(last.date) - DAYS_PER_YEAR * MS_PER_DAY);
  const before = [...sorted].reverse().find((s) => s.date <= windowStart) ?? sorted[0];
  const days = daysBetween(before.date, last.date);
  if (days < MIN_DAYS_FOR_CONTRIBUTION_ESTIMATE) return null;
  return ((last.netContributions - before.netContributions) / days) * (DAYS_PER_YEAR / QUARTERS_PER_YEAR);
}

export interface ProjectionRates {
  prudent: number;
  base: number;
  optimistic: number;
}

export interface ProjectionPoint {
  year: number;
  prudent: number;
  base: number;
  optimistic: number;
}

/**
 * Proiezione in euro di oggi: `startValue` più un versamento trimestrale costante, con rendimenti **reali** (al netto
 * dell'inflazione) in tre scenari. È una stima, non una promessa.
 */
export function projectPension(params: { startValue: number; quarterlyContribution: number; years: number; rates: ProjectionRates }): ProjectionPoint[] {
  const { startValue, quarterlyContribution, years, rates } = params;
  const total = Math.max(0, Math.round(years));
  const values = { prudent: startValue, base: startValue, optimistic: startValue };
  const points: ProjectionPoint[] = [{ year: 0, ...values }];
  for (let year = 1; year <= total; year += 1) {
    for (let q = 0; q < QUARTERS_PER_YEAR; q += 1) {
      for (const key of ["prudent", "base", "optimistic"] as const) {
        values[key] = values[key] * (1 + rates[key]) ** (1 / QUARTERS_PER_YEAR) + quarterlyContribution;
      }
    }
    points.push({ year, ...values });
  }
  return points;
}

/** Un anno di vita del fondo: quanto è stato versato e quanto ha reso (valore finale meno valore iniziale meno versamenti). */
export interface YearBreakdown {
  year: number;
  contributions: number;
  /** Variazione di valore non dovuta ai versamenti; può essere negativa. */
  gain: number;
  endValue: number;
  /** Vero se l'anno non è finito (ultima fotografia prima del 31/12). */
  partial: boolean;
}

/**
 * Ripartizione anno per anno tra versamenti e rendimento, dalle ultime fotografie di ogni anno. Il primo anno parte da
 * zero; un anno senza fotografie viene saltato (il suo effetto finisce nell'anno successivo).
 */
export function yearlyBreakdown(snapshots: PensionSnapshot[]): YearBreakdown[] {
  const sorted = sortSnapshots(snapshots);
  const lastOfYear = new Map<number, PensionSnapshot>();
  for (const s of sorted) lastOfYear.set(Number(s.date.slice(0, 4)), s);
  const years = [...lastOfYear.keys()].sort((a, b) => a - b);
  const latest = sorted.at(-1);
  let previous = { netContributions: 0, value: 0 };
  return years.map((year) => {
    const end = lastOfYear.get(year)!;
    const contributions = end.netContributions - previous.netContributions;
    const gain = end.value - previous.value - contributions;
    previous = end;
    return { year, contributions, gain, endValue: end.value, partial: end === latest && !end.date.endsWith("-12-31") };
  });
}
