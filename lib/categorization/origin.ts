/**
 * Testi che spiegano da dove viene una categoria (proposta o applicata da sola) e quando sono i movimenti: un solo
 * vocabolario per carte, elenco, «Messe dall'app» e Movimenti.
 */

import { formatDateWithYear, formatShortDate } from "@/lib/format";
import type { CategorizeSuggestion } from "./suggest";

export type CategoryOrigin = "regola" | "storico" | "assistente";

/** Nome breve di ogni origine, come compare nei badge. */
export const ORIGIN_NAMES: Record<CategoryOrigin, string> = {
  regola: "Regola",
  storico: "Le tue scelte",
  assistente: "AI",
};

/** Percentuale intera di una sicurezza 0-1. */
export function confidencePercent(confidence: number): number {
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}

/** Una riga che dice perché si propone questa categoria, senza gergo. */
export function suggestionOriginText(suggestion: CategorizeSuggestion): string {
  if (suggestion.source === "assistente") return "Proposta dall'AI";
  if (suggestion.source === "regola") {
    return suggestion.rulePattern ? `Simile alla tua regola «${suggestion.rulePattern}»` : "Simile a una tua regola";
  }
  const history = suggestion.history;
  if (!history) return "Come i tuoi movimenti passati";
  if (history.total === 1) return "Come l'unico tuo movimento simile";
  if (history.agreeing === history.total) return `Come tutti i tuoi ${history.total} movimenti simili`;
  return `Come ${history.agreeing} dei tuoi ${history.total} movimenti simili`;
}

/**
 * Etichetta breve di una categoria messa dall'app: «Regola», «Le tue scelte», «AI». Senza percentuale: a chi non è
 * esperto non dice nulla, e quella esatta resta nel tooltip (`autoOriginDescription`).
 */
export function autoOriginLabel(source: CategoryOrigin): string {
  return ORIGIN_NAMES[source];
}

/** Spiegazione estesa dell'origine di una categoria messa dall'app, con la sicurezza (per tooltip e lettori di schermo). */
export function autoOriginDescription(source: CategoryOrigin, confidence: number | null): string {
  if (source === "regola") return "Messa dall'app con una tua regola";
  const percent = confidence === null ? "" : ` (sicura al ${confidencePercent(confidence)}%)`;
  return source === "assistente"
    ? `Messa dall'app: proposta dell'AI${percent}`
    : `Messa dall'app: la scegli sempre per questo esercente${percent}`;
}

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

/**
 * Quando sono avvenuti dei movimenti, in breve: «9 ott», «2–9 ott», «28 set – 9 ott». Con l'anno se non è quello in
 * corso o se l'intervallo lo attraversa.
 */
export function dateRangeLabel(dates: readonly string[], today: Date = new Date()): string {
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
