/** Formattazione condivisa dalle card di Analitiche. */

import { formatCurrency } from "@/lib/format";

export const pct = (value: number, digits = 1): string => `${(value * 100).toFixed(digits).replace(".", ",")}%`;

export const money = (value: number, currency: string): string => formatCurrency(value, currency, { maximumFractionDigits: 0 });

/** Anni con un decimale ("12,5 anni"), "già raggiunto" a zero, "oltre 80 anni / mai" se null. */
export function formatYears(years: number | null): string {
  if (years === null) return "oltre 80 anni";
  if (years === 0) return "già raggiunto";
  return `${years.toFixed(1).replace(".", ",")} anni`;
}

/** Indice decimale in italiano con `digits` cifre. */
export const num = (value: number, digits = 2): string => value.toFixed(digits).replace(".", ",");
