
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedDebtFormats(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);


/** "febbraio 2027" da una data ISO. */
function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

/** "4 anni e 5 mesi", "1 anno", "7 mesi": una durata in mesi, a parole. */
function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years > 0 ? tr(years === 1 ? "{0} anno" : "{0} anni", {0: years}) : "", rest > 0 ? tr(rest === 1 ? "{0} mese" : "{0} mesi", {0: rest}) : ""].filter(Boolean);
  return parts.length > 0 ? new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(parts) : tr("0 mesi");
}
  return { formatMonthYear, formatDuration };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { formatMonthYear, formatDuration } = localizedDebtFormats("it");
