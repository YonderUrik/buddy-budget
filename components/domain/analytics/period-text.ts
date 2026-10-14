/** Testi sul periodo dei dati di Analitiche: etichette brevi e frasi «negli ultimi 12 mesi» / «da gen 2024 a dic 2025». */

import { parseDateOnly } from "@/lib/calc/expenses";
import type { DataPeriod } from "@/lib/analitiche/period";
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedPeriodText(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const MONTH = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });

/** «ott 2025» da una data AAAA-MM-GG o AAAA-MM. */
function monthText(key: string): string {
  return MONTH.format(parseDateOnly(key.length === 7 ? `${key}-01` : key)).replace(".", "");
}

/** «ott 2025 – set 2026». */
function rangeText(fromKey: string, toKey: string): string {
  return `${monthText(fromKey)} – ${monthText(toKey)}`;
}

/** Frase per il periodo: «negli ultimi 12 mesi» o «da gen 2024 a dic 2025». */
function periodPhrase(period: DataPeriod, fromKey: string, toKey: string): string {
  return period.kind === "ultimi" ? tr("negli ultimi {0} mesi", { 0: period.months }) : tr("da {0} a {1}", { 0: monthText(fromKey), 1: monthText(toKey) });
}
  return { monthText, rangeText, periodPhrase };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { monthText, rangeText, periodPhrase } = localizedPeriodText("it");
