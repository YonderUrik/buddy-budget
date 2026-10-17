/** Formattazione condivisa dalle card di Analitiche. */

import { localizedFormats } from "@/lib/localization/format";
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedAnalyticsFormats(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const { formatCurrency } = localizedFormats(locale);
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const pct = (value: number, digits = 1): string => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

const money = (value: number, currency: string): string => formatCurrency(value, currency, { maximumFractionDigits: 0 });

/** Anni con un decimale ("12,5 anni"), "già raggiunto" a zero, "oltre 80 anni / mai" se null. */
function formatYears(years: number | null): string {
  if (years === null) return tr("oltre 80 anni");
  if (years === 0) return tr("già raggiunto");
  return tr("{0} anni", { 0: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(years) });
}

/** "In 12.5 years" form for a future arrival; same fallbacks as `formatYears`. */
function formatYearsFromNow(years: number | null): string {
  if (years === null || years === 0) return formatYears(years);
  return tr("tra {0} anni", { 0: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(years) });
}

/** Indice decimale in italiano con `digits` cifre. */
const num = (value: number, digits = 2): string => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return { pct, money, formatYears, formatYearsFromNow, num };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { pct, money, formatYears, num } = localizedAnalyticsFormats("it");
