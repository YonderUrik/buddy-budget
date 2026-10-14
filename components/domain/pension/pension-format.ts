/** Formattazione condivisa dalle card di Pensione. */

import { localizedFormats } from "@/lib/localization/format";

import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedPensionFormats(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const { formatCurrency } = localizedFormats(locale);

const formatPercent = (value: number, digits = 1): string => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

const formatSignedPercent = (value: number, digits = 1): string => `${value >= 0 ? "+" : "−"}${formatPercent(Math.abs(value), digits)}`;

const money = (value: number, currency: string): string => formatCurrency(value, currency, { maximumFractionDigits: 0 });

const MONTH_YEAR = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" });

/** Etichetta corta del grafico (es. "set 26"). */
function formatChartDate(key: string): string {
  return MONTH_YEAR.format(new Date(`${key}T00:00:00Z`)).replace(".", "");
}

const LONG_DATE = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function formatLongDateKey(key: string): string {
  return LONG_DATE.format(new Date(`${key}T00:00:00Z`));
}

const SHORT_DATE = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Data corta per le tabelle (es. "30 set 2026"). */
function formatShortDateKey(key: string): string {
  return SHORT_DATE.format(new Date(`${key}T00:00:00Z`)).replace(/\./g, "");
}
  return { formatPercent, formatSignedPercent, money, formatChartDate, formatLongDateKey, formatShortDateKey };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { formatPercent, formatSignedPercent, money, formatChartDate, formatLongDateKey, formatShortDateKey } = localizedPensionFormats("it");
