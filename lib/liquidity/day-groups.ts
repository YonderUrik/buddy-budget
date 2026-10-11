/** Raggruppa i movimenti per giorno (dal più recente) con etichetta parlante e totale del giorno. Logica pura. */

import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { effectiveAmount, parseDateOnly, startOfDay } from "@/lib/calc/expenses";
import type { Transaction } from "@/lib/db/schema/transactions";

export interface DayGroup {
  /** Data del giorno (YYYY-MM-DD). */
  date: string;
  /** "Oggi", "Ieri" oppure "lunedì 5 ottobre" (con l'anno se non è quello corrente). */
  label: string;
  /** Somma degli importi effettivi del giorno (entrate positive, uscite negative). */
  total: number;
  items: Transaction[];
}

const DAY_FORMAT = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });
const DAY_YEAR_FORMAT = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Etichetta di un giorno rispetto a `today`. */
export function dayLabel(date: string, today: Date): string {
  const todayStart = startOfDay(today);
  if (date === toDateKey(todayStart)) return "Oggi";
  if (date === toDateKey(addDays(todayStart, -1))) return "Ieri";
  const parsed = parseDateOnly(date);
  return (parsed.getFullYear() === todayStart.getFullYear() ? DAY_FORMAT : DAY_YEAR_FORMAT).format(parsed);
}

/** Raggruppa per data, giorni dal più recente; dentro il giorno l'ordine ricevuto è mantenuto. */
export function groupByDay(transactions: Transaction[], today: Date): DayGroup[] {
  const byDate = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    byDate.set(transaction.date, [...(byDate.get(transaction.date) ?? []), transaction]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({
      date,
      label: dayLabel(date, today),
      total: Math.round(items.reduce((sum, t) => sum + effectiveAmount(t), 0) * 100) / 100,
      items,
    }));
}
