import type { InvestmentTransactionInput } from "@/lib/calc/investments";
import type { OperationInsight } from "./operations-history";

/** Finestra del "negli ultimi 12 mesi": da oggi indietro di un anno, estremo escluso. */
const TRAILING_MONTHS = 12;
/** Strumenti mostrati nella classifica dei proventi. */
export const INCOME_TOP_INSTRUMENTS = 5;

const INCOME_TYPES = new Set(["dividendo", "cedola"]);

/** Proventi netti di un anno. */
export interface IncomeYear {
  year: number;
  amount: number;
}

/** Proventi netti di uno strumento. */
export interface IncomeByInstrument {
  instrumentId: string;
  /** Ultimi 12 mesi. */
  trailing: number;
  /** Da sempre. */
  total: number;
}

/** Storico di dividendi e cedole, in valuta utente e al netto di imposte e commissioni. */
export interface IncomeHistory {
  total: number;
  /** Ultimi 12 mesi. */
  trailing: number;
  /** Proventi degli ultimi 12 mesi sul costo di carico attuale (null senza costo). */
  yieldOnCost: number | null;
  /** Dal primo anno con un provento a quello in corso, anche gli anni senza. */
  years: IncomeYear[];
  /** Dal più alto degli ultimi 12 mesi, poi da sempre. */
  topInstruments: IncomeByInstrument[];
  count: number;
}

function shiftMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

/** Storico dei proventi dagli esiti delle operazioni (`received` è già netto e in valuta utente). */
export function computeIncomeHistory<T extends InvestmentTransactionInput>(
  insights: OperationInsight<T>[],
  costBasis: number,
  todayKey: string
): IncomeHistory {
  const trailingFrom = shiftMonths(todayKey, -TRAILING_MONTHS);
  const byYear = new Map<number, number>();
  const byInstrument = new Map<string, IncomeByInstrument>();
  let total = 0;
  let trailing = 0;
  let count = 0;

  for (const insight of insights) {
    const t = insight.transaction;
    if (!INCOME_TYPES.has(t.type) || t.date > todayKey) continue;
    const amount = insight.received;
    const recent = t.date > trailingFrom;
    count += 1;
    total += amount;
    if (recent) trailing += amount;
    const year = Number(t.date.slice(0, 4));
    byYear.set(year, (byYear.get(year) ?? 0) + amount);
    const instrument = byInstrument.get(t.instrumentId) ?? { instrumentId: t.instrumentId, trailing: 0, total: 0 };
    instrument.total += amount;
    if (recent) instrument.trailing += amount;
    byInstrument.set(t.instrumentId, instrument);
  }

  const currentYear = Number(todayKey.slice(0, 4));
  const firstYear = byYear.size > 0 ? Math.min(...byYear.keys()) : currentYear;
  const years: IncomeYear[] = [];
  for (let year = firstYear; year <= currentYear && byYear.size > 0; year += 1) {
    years.push({ year, amount: byYear.get(year) ?? 0 });
  }

  return {
    total,
    trailing,
    yieldOnCost: costBasis > 0 ? trailing / costBasis : null,
    years,
    topInstruments: [...byInstrument.values()]
      .sort((a, b) => b.trailing - a.trailing || b.total - a.total)
      .slice(0, INCOME_TOP_INSTRUMENTS),
    count,
  };
}
