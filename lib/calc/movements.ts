/** Calcoli della sezione Movimenti che non appartengono né a Transazioni né a Cash flow: finestra dei grafici mensili e tasso di risparmio. */

import { addMonths, endOfMonth, startOfMonth, type DateRange, type ExpensePeriod } from "@/lib/calc/expenses";

/** Mesi mostrati nei grafici mensili, per tutti i periodi tranne "anno". */
export const TREND_MONTHS_DEFAULT = 6;
/** Mesi mostrati nei grafici mensili quando il periodo scelto è "anno". */
export const TREND_MONTHS_YEAR = 12;

/**
 * Finestra dei grafici mensili (entrate/uscite, per categoria, risparmio accumulato): termina nel mese guardato
 * e copre 6 mesi, o 12 se il periodo scelto è "anno". Così un solo selettore di periodo governa tutta l'Analisi.
 */
export function getTrendRange(period: ExpensePeriod, referenceDate: Date): DateRange {
  const months = period === "anno" ? TREND_MONTHS_YEAR : TREND_MONTHS_DEFAULT;
  return {
    from: startOfMonth(addMonths(startOfMonth(referenceDate), -(months - 1))),
    to: endOfMonth(referenceDate),
  };
}

/** Quota delle entrate messa da parte, da -∞ a 1; `null` se non ci sono entrate (il rapporto non ha senso). */
export function computeSavingsRate(income: number, expenses: number): number | null {
  if (income <= 0) return null;
  return (income - expenses) / income;
}
