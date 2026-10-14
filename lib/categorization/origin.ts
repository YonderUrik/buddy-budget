/**
 * Testi che spiegano da dove viene una categoria (proposta o applicata da sola) e quando sono i movimenti: un solo
 * vocabolario per carte, elenco, «Messe dall'app» e Movimenti.
 */

import { localizedFormats } from "@/lib/localization/format";
import type { CategorizeSuggestion } from "./suggest";

export type CategoryOrigin = "regola" | "storico" | "assistente";
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedCategorizationText(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const { formatDateWithYear, formatShortDate } = localizedFormats(locale);
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const ORIGIN_NAMES: Record<CategoryOrigin, string> = {
  regola: "Regola",
  storico: tr("Le tue scelte"),
  assistente: "AI",
};

/** Percentuale intera di una sicurezza 0-1. */
function confidencePercent(confidence: number): number {
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}

/** Una riga che dice perché si propone questa categoria, senza gergo. */
function suggestionOriginText(suggestion: CategorizeSuggestion): string {
  if (suggestion.source === "assistente") return tr("Proposta dall'AI");
  if (suggestion.source === "regola") {
    return suggestion.rulePattern ? tr("Simile alla tua regola «{0}»", { 0: suggestion.rulePattern }) : tr("Simile a una tua regola");
  }
  const history = suggestion.history;
  if (!history) return tr("Come i tuoi movimenti passati");
  if (history.total === 1) return tr("Come l'unico tuo movimento simile");
  if (history.agreeing === history.total) return tr("Come tutti i tuoi {0} movimenti simili", { 0: history.total });
  return tr("Come {0} dei tuoi {1} movimenti simili", { 0: history.agreeing, 1: history.total });
}

/**
 * Etichetta breve di una categoria messa dall'app: «Regola», «Le tue scelte», «AI». Senza percentuale: a chi non è
 * esperto non dice nulla, e quella esatta resta nel tooltip (`autoOriginDescription`).
 */
function autoOriginLabel(source: CategoryOrigin): string {
  return ORIGIN_NAMES[source];
}

/** Spiegazione estesa dell'origine di una categoria messa dall'app, con la sicurezza (per tooltip e lettori di schermo). */
function autoOriginDescription(source: CategoryOrigin, confidence: number | null): string {
  if (source === "regola") return tr("Messa dall'app con una tua regola");
  const percent = confidence === null ? "" : tr(" (sicura al {0}%)", { 0: confidencePercent(confidence) });
  return source === "assistente"
    ? tr("Messa dall'app: proposta dell'AI{0}", { 0: percent })
    : tr("Messa dall'app: la scegli sempre per questo esercente{0}", { 0: percent });
}

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

/**
 * Quando sono avvenuti dei movimenti, in breve: «9 ott», «2–9 ott», «28 set – 9 ott». Con l'anno se non è quello in
 * corso o se l'intervallo lo attraversa.
 */
function dateRangeLabel(dates: readonly string[], today: Date = new Date()): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const withYear = yearOf(first) !== yearOf(last) || yearOf(last) !== today.getFullYear();
  const format = withYear ? formatDateWithYear : formatShortDate;
  if (first === last) return format(first);
  if (!withYear && first.slice(0, 7) === last.slice(0, 7)) return `${Number(first.slice(8, 10))}–${formatShortDate(last)}`;
  return `${format(first)} – ${format(last)}`;
}
  return { ORIGIN_NAMES, confidencePercent, suggestionOriginText, autoOriginLabel, autoOriginDescription, dateRangeLabel };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { ORIGIN_NAMES, confidencePercent, suggestionOriginText, autoOriginLabel, autoOriginDescription, dateRangeLabel } = localizedCategorizationText("it");
