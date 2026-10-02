/** Formattazione condivisa dalle card di Pensione. */

import { formatCurrency } from "@/lib/format";

export const formatPercent = (value: number, digits = 1): string => `${(value * 100).toFixed(digits).replace(".", ",")}%`;

export const formatSignedPercent = (value: number, digits = 1): string => `${value >= 0 ? "+" : "−"}${formatPercent(Math.abs(value), digits)}`;

export const money = (value: number, currency: string): string => formatCurrency(value, currency, { maximumFractionDigits: 0 });

const MONTH_YEAR = new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit", timeZone: "UTC" });

/** Etichetta corta del grafico (es. "set 26"). */
export function formatChartDate(key: string): string {
  return MONTH_YEAR.format(new Date(`${key}T00:00:00Z`)).replace(".", "");
}

const LONG_DATE = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function formatLongDateKey(key: string): string {
  return LONG_DATE.format(new Date(`${key}T00:00:00Z`));
}

const SHORT_DATE = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Data corta per le tabelle (es. "30 set 2026"). */
export function formatShortDateKey(key: string): string {
  return SHORT_DATE.format(new Date(`${key}T00:00:00Z`)).replace(/\./g, "");
}
