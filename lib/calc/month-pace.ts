import type { Budget } from "@/lib/db/schema/budgets";
import type { Transaction } from "@/lib/db/schema/transactions";
import { addMonths, computeIncomeSummary, computeSummary, endOfMonth, startOfDay, startOfMonth } from "./expenses";

/** Quanti mesi precedenti si usano per stimare "quanto si spende di solito" a questo punto del mese. */
export const MONTH_PACE_LOOKBACK = 3;

export interface MonthPace {
  /** Spese effettive dall'inizio del mese a oggi. */
  spentSoFar: number;
  /** Media delle spese effettive degli ultimi mesi fino allo stesso giorno (null senza storico). */
  typicalSoFar: number | null;
  /** Entrate effettive del mese a oggi. */
  income: number;
  /** Budget mensile totale (null se non ne è impostato nessuno). */
  budgetTotal: number | null;
  /** Spesa del mese sulle sole categorie con budget (confrontabile con `budgetTotal`). */
  budgetSpent: number;
  dayOfMonth: number;
  daysInMonth: number;
  /** Spesa cumulata del mese corrente, un valore per ogni giorno da 1 a oggi. */
  current: number[];
  /** Spesa cumulata media dei mesi precedenti, un valore per ogni giorno del mese (null senza storico). */
  typical: number[] | null;
}

/** Spesa effettiva cumulata giorno per giorno nel mese che inizia a `monthStart`, fino a `lastDay` compreso. */
function cumulativeByDay(transactions: Transaction[], monthStart: Date, lastDay: number): number[] {
  const perDay = new Array<number>(lastDay).fill(0);
  for (const t of transactions) {
    if (Number(t.amount) >= 0) continue;
    const [y, m, d] = t.date.split("-").map(Number);
    if (y !== monthStart.getFullYear() || m - 1 !== monthStart.getMonth() || d > lastDay) continue;
    perDay[d - 1] += Math.abs(Number(t.amount)) - Math.abs(Number(t.excludedAmount));
  }
  let total = 0;
  return perDay.map((value) => (total += value));
}

/**
 * Ritmo di spesa del mese corrente: speso finora contro la media dello stesso tratto di mese nei tre mesi
 * precedenti, entrate e budget. Il confronto usa lo stesso giorno (clamp nei mesi corti) per non penalizzare
 * l'inizio mese. Lo storico conta solo se almeno un mese precedente ha movimenti.
 */
export function computeMonthPace(transactions: Transaction[], budgets: Budget[], today: Date): MonthPace {
  const day = startOfDay(today);
  const monthStart = startOfMonth(day);
  const elapsed = { from: monthStart, to: day };
  const { speseEffettive: spentSoFar } = computeSummary(transactions, elapsed);
  const { entrateEffettive: income } = computeIncomeSummary(transactions, elapsed);

  const past: number[] = [];
  const pastCurves: number[][] = [];
  const daysInMonth = endOfMonth(day).getDate();
  for (let back = 1; back <= MONTH_PACE_LOOKBACK; back += 1) {
    const from = addMonths(monthStart, -back);
    const lastDay = endOfMonth(from).getDate();
    const to = new Date(from.getFullYear(), from.getMonth(), Math.min(day.getDate(), lastDay));
    const full = { from, to: endOfMonth(from) };
    const hasData = computeSummary(transactions, full).uscite > 0;
    if (hasData) {
      past.push(computeSummary(transactions, { from, to }).speseEffettive);
      // La curva di un mese più corto si prolunga col suo ultimo valore, così le medie hanno sempre `daysInMonth` punti.
      const curve = cumulativeByDay(transactions, from, lastDay);
      pastCurves.push(Array.from({ length: daysInMonth }, (_, i) => curve[Math.min(i, lastDay - 1)]));
    }
  }
  const typicalSoFar = past.length > 0 ? past.reduce((a, b) => a + b, 0) / past.length : null;

  const budgetTotal = budgets.length > 0 ? budgets.reduce((sum, b) => sum + Number(b.monthlyAmount), 0) : null;
  const budgeted = new Set(budgets.map((b) => b.categoryId));
  const { speseEffettive: budgetSpent } = computeSummary(
    transactions.filter((t) => budgeted.has(t.categoryId)),
    elapsed
  );

  const typical = pastCurves.length > 0 ? Array.from({ length: daysInMonth }, (_, i) => pastCurves.reduce((sum, c) => sum + c[i], 0) / pastCurves.length) : null;

  return {
    spentSoFar,
    typicalSoFar,
    income,
    budgetTotal,
    budgetSpent,
    dayOfMonth: day.getDate(),
    daysInMonth,
    current: cumulativeByDay(transactions, monthStart, day.getDate()),
    typical,
  };
}
