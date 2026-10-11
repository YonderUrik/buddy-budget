/** Curva delle spese cumulate giorno per giorno in un intervallo. Logica pura. */

import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { isExpense, parseDateOnly, startOfDay, type DateRange } from "@/lib/calc/expenses";
import type { Transaction } from "@/lib/db/schema/transactions";

export interface SpendPoint {
  date: string;
  /** Spesa effettiva (al netto della parte esclusa) cumulata dall'inizio dell'intervallo. */
  value: number;
}

/** Un punto per giorno da `range.from` fino a `min(range.to, today)`; le uscite escluse con "Dividi" contano solo per la parte tua. */
export function buildCumulativeSpend(transactions: Transaction[], range: DateRange, today: Date): SpendPoint[] {
  const last = Math.min(startOfDay(range.to).getTime(), startOfDay(today).getTime());
  const perDay = new Map<string, number>();
  for (const t of transactions) {
    if (!isExpense(t)) continue;
    const day = parseDateOnly(t.date).getTime();
    if (day < startOfDay(range.from).getTime() || day > last) continue;
    perDay.set(t.date, (perDay.get(t.date) ?? 0) + Math.abs(Number(t.amount)) - Math.abs(Number(t.excludedAmount)));
  }
  const points: SpendPoint[] = [];
  let total = 0;
  for (let cursor = startOfDay(range.from); cursor.getTime() <= last; cursor = addDays(cursor, 1)) {
    const key = toDateKey(cursor);
    total += perDay.get(key) ?? 0;
    points.push({ date: key, value: Math.round(total * 100) / 100 });
  }
  return points;
}
