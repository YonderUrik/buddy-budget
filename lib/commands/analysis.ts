/**
 * A question about the user's movements that needs more than one total: an average, a count, the biggest ones, a split
 * by category, merchant, account or month, a comparison with an earlier period («quanto spendo in media al mese al
 * supermercato», «in quale mese ho speso di più quest'anno», «le 5 spese più grandi di ottobre», «quante volte sono
 * andato da McDonald's», «uscite per categoria rispetto all'anno scorso»). The model behind «Chiedi all'AI» fills this
 * closed shape from the sentence alone; `cleanAnalysis` checks every value before the server computes anything, so the
 * model never writes a query, never sees a movement and never produces a figure.
 */

import type { ExpenseGroup } from "@/lib/categories/groups";
import type { RawAnalysis } from "./analysis-schema";
import type { CommandLanguage } from "./types";
import { fold } from "./words";

export const ANALYSIS_MEASURES = ["somma", "media", "mediana", "conteggio", "massimo", "minimo", "elenco"] as const;
export type AnalysisMeasure = (typeof ANALYSIS_MEASURES)[number];

/** What an average is of: one movement («spesa media al bar») or a span of time («al mese»). */
export const ANALYSIS_PER = ["movimento", "giorno", "settimana", "mese", "anno"] as const;
export type AnalysisPer = (typeof ANALYSIS_PER)[number];

/** Money out, money in, or in minus out («quanto ho risparmiato»). */
export const ANALYSIS_DIRECTIONS = ["uscite", "entrate", "netto"] as const;
export type AnalysisDirection = (typeof ANALYSIS_DIRECTIONS)[number];

export const ANALYSIS_GROUP_BY = ["categoria", "gruppo", "esercente", "conto", "mese", "settimana", "giorno_settimana", "anno"] as const;
export type AnalysisGroupBy = (typeof ANALYSIS_GROUP_BY)[number];
/** Splits along time: shown in order of time (a small bar chart), not by size, unless the question asks for a ranking. */
export const TIME_GROUP_BY: ReadonlySet<AnalysisGroupBy> = new Set(["mese", "settimana", "anno"]);

/** The same span just before (`precedente`) or one year earlier (`anno_prima`). */
export const ANALYSIS_COMPARE = ["precedente", "anno_prima"] as const;
export type AnalysisCompare = (typeof ANALYSIS_COMPARE)[number];

export const ANALYSIS_DAYS = ["feriali", "weekend"] as const;
export type AnalysisDays = (typeof ANALYSIS_DAYS)[number];

/** Rows a split or a list can show: enough to read, never a full table (that is Movimenti's job). */
export const ANALYSIS_MAX_LIMIT = 10;
const DEFAULT_LIMIT = 5;
/** Months looked at when the sentence names no period: the last twelve whole months and this one so far. */
export const ANALYSIS_DEFAULT_MONTHS = 12;
/** Oldest day a question can be about. */
const OLDEST_DAY = "2000-01-01";
const MAX_AMOUNT = 10_000_000;

export interface AnalysisFilters {
  /** Words to find in the description or the note (folded); empty = any. */
  text: string;
  /** A category as written (folded); the server matches it to one of the user's, or falls back to the words. */
  category: string;
  /** A spending group (Dovute, Volute, Te futuro, Saltuarie). */
  group: ExpenseGroup | null;
  /** An account as written (folded). */
  account: string;
  /** Bounds on the size of one movement (absolute, in the user's currency). */
  min: number | null;
  max: number | null;
  days: AnalysisDays | null;
}

export interface AnalysisQuery {
  kind: "analisi";
  measure: AnalysisMeasure;
  /** Only for an average; `movimento` otherwise. */
  per: AnalysisPer;
  direction: AnalysisDirection;
  filters: AnalysisFilters;
  /** First and last day (ISO), within what the user can have; `all` when the sentence asked for everything. */
  from: string;
  to: string;
  all: boolean;
  /** True when the sentence named no period and the default (the last 12 months) applies: said on the card. */
  defaultPeriod: boolean;
  groupBy: AnalysisGroupBy | null;
  /** Ranking of a split or a list: biggest first unless the question asks for the smallest. */
  order: "desc" | "asc";
  limit: number;
  compare: AnalysisCompare | null;
  language: CommandLanguage;
}

/** Keeps a printable, short value written by the model (no control characters, markup or links), folded. */
function cleanWords(value: string | null | undefined): string {
  return fold((value ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim()).slice(0, 60);
}

/** A real day (ISO) or null. */
function realDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

/** First day of the month `back` months before the one of `today` (ISO). */
export function monthStartBack(today: string, back: number): string {
  const [year, month] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - back, 1));
  return date.toISOString().slice(0, 10);
}

const amount = (value: number | null | undefined) => (value === null || value === undefined || !Number.isFinite(value) || value <= 0 ? null : Math.min(Math.abs(value), MAX_AMOUNT));

/**
 * The model's analysis made safe: words folded and shortened, a period inside 2000…today (the last 12 months when none
 * was named, from/to swapped when reversed), bounds positive, a limit between 1 and 10. Never throws: an odd value
 * falls back to its default.
 */
export function cleanAnalysis(raw: RawAnalysis, options: { language: CommandLanguage; today: string }): AnalysisQuery {
  const { today, language } = options;
  const measure = raw.measure ?? "somma";
  let from = realDay(raw.from);
  let to = realDay(raw.to);
  const all = raw.all === true;
  if (to !== null && to > today) to = today;
  if (from !== null && from > today) from = null;
  if (from !== null && to !== null && from > to) [from, to] = [to, from];
  if (from !== null && from < OLDEST_DAY) from = OLDEST_DAY;
  const defaultPeriod = !all && from === null && to === null;
  const min = amount(raw.minAmount);
  let max = amount(raw.maxAmount);
  if (min !== null && max !== null && max < min) max = null;
  const groupBy = raw.groupBy ?? null;
  const limit = Math.min(ANALYSIS_MAX_LIMIT, Math.max(1, Math.trunc(raw.limit ?? (groupBy !== null && TIME_GROUP_BY.has(groupBy) ? ANALYSIS_MAX_LIMIT : DEFAULT_LIMIT))));
  const text = cleanWords(raw.text);
  const category = cleanWords(raw.category);
  return {
    kind: "analisi",
    measure,
    per: measure === "media" ? (raw.per ?? "movimento") : "movimento",
    direction: raw.direction ?? "uscite",
    filters: {
      text,
      // The same word as text and as category is the model hedging: the server tries it as a category first anyway.
      category: category === text ? "" : category,
      group: raw.group ?? null,
      account: cleanWords(raw.account),
      min,
      max,
      days: raw.days ?? null,
    },
    from: all ? OLDEST_DAY : (from ?? (to !== null ? monthStartBack(to, ANALYSIS_DEFAULT_MONTHS) : monthStartBack(today, ANALYSIS_DEFAULT_MONTHS))),
    to: to ?? today,
    all,
    defaultPeriod,
    groupBy,
    order: raw.order ?? (measure === "minimo" ? "asc" : "desc"),
    limit,
    compare: all ? null : (raw.compare ?? null),
    language,
  };
}

/** Words that make a sentence an analysis rather than a plain total: the rules leave it to «Chiedi all'AI». */
const ANALYSIS_WORDS = new Set([
  "media", "medio", "mediamente", "mediana", "volte", "spesso", "piu", "meno", "maggiore", "maggiori", "grande", "grandi", "piccola", "piccole", "ogni", "categoria", "categorie", "confronto", "rispetto", "risparmiato", "risparmio", "mostra", "mostrami", "elenca", "elencami", "sopra", "sotto", "oltre", "weekend",
  "average", "avg", "median", "times", "often", "most", "least", "biggest", "largest", "smallest", "each", "every", "category", "categories", "compared", "versus", "vs", "saved", "show", "list", "above", "over", "below", "under",
  "durchschnitt", "durchschnittlich", "median", "mal", "oft", "meisten", "wenigsten", "grosste", "grossten", "kleinste", "jeden", "jede", "pro", "kategorie", "kategorien", "vergleich", "gespart", "zeige", "zeig", "liste", "uber", "unter", "wochenende",
]);

/** Whether a sentence asks for more than one total (an average, a count, a ranking, a split): the AI reads it. */
export function needsAnalysis(text: string): boolean {
  return fold(text)
    .replace(/[?!.,;:'’]+/g, " ")
    .split(/\s+/)
    .some((word) => ANALYSIS_WORDS.has(word));
}
