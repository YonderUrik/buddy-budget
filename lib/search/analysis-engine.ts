/**
 * The arithmetic behind an analysis in «Cerca» (`AnalysisQuery`): pure, over movements the server already read and
 * decrypted for one user. It filters them like Movimenti (effective amounts after «Dividi», transfers left out since
 * they are excluded in full), then computes one figure (a total, an average per movement or per span of time, a median,
 * a count, the biggest or smallest), an optional split (by category, spending group, merchant, account, month, week,
 * day of the week, year), and the same figure for an earlier span when the question compares.
 *
 * Amounts are magnitudes for spending and income (a ranking of «spese più grandi» reads naturally) and signed for
 * `netto` (income minus spending); the card puts the sign back.
 */

import { EXPENSE_GROUP_KEYS, type CategoryType } from "@/lib/categories/groups";
import { TIME_GROUP_BY, type AnalysisGroupBy, type AnalysisQuery } from "@/lib/commands/analysis";
import { foldText } from "./normalize";

/** One movement as the engine needs it; text fields only when the query reads them (they are decrypted to get them). */
export interface AnalysisRow {
  id: string;
  date: string;
  /** Effective signed amount: `amount - excluded_amount`. */
  amount: number;
  categoryId: string;
  accountId: string;
  description?: string;
  note?: string | null;
}

export interface AnalysisCategory {
  name: string;
  type: CategoryType;
  isFallback: boolean;
}

/** The user's filters once matched to their own rows: ids instead of words. */
export interface ResolvedFilters {
  text: string;
  categoryId: string | null;
  group: AnalysisQuery["filters"]["group"];
  accountId: string | null;
  min: number | null;
  max: number | null;
  days: AnalysisQuery["filters"]["days"];
}

export interface AnalysisContext {
  categories: Map<string, AnalysisCategory>;
  accounts: Map<string, string>;
  /** Day of the user's first movement (any): averages over time start there when the period starts earlier. */
  firstDay: string | null;
  today: string;
  /** First day the text of movements was read from (24 months): a text filter or a split by merchant before it is partial. */
  textFrom: string | null;
}

export type AnalysisLabelKind = "nome" | "gruppo" | "mese" | "settimana" | "anno" | "giorno_settimana";

export interface AnalysisResultRow {
  key: string;
  /** A name (category, merchant, account) or, for time, the ISO start of the span; the card formats it. */
  label: string;
  labelKind: AnalysisLabelKind;
  value: number;
  count: number;
  /** Movements: their day and id (opens the detail). */
  date?: string;
  movementId?: string;
  /** What a split row filters Movimenti by. */
  categoryId?: string;
  accountId?: string;
  text?: string;
  /** Time rows: the span they cover. */
  from?: string;
  to?: string;
}

export interface AnalysisResult {
  /** The figure the card leads with; null when nothing matched. */
  value: number | null;
  unit: "denaro" | "volte";
  /** Movements matched in the period. */
  count: number;
  /** Their total (magnitude; signed for `netto`). */
  total: number;
  /** What an average over time is divided by (months, weeks…), rounded for the line; null otherwise. */
  span: number | null;
  /** The winning split row of a «which month / which category» question. */
  top: AnalysisResultRow | null;
  rows: AnalysisResultRow[];
  rowsKind: "gruppi" | "serie" | "movimenti" | null;
  /** Split rows beyond the limit, summed. */
  others: { value: number; count: number; groups: number } | null;
  comparison: { value: number | null; from: string; to: string } | null;
  from: string;
  to: string;
  /** The split actually used (a month split over many years becomes a split by year). */
  groupBy: AnalysisGroupBy | null;
  /** True when the movements' text could not be read for part of the period (older than 24 months). */
  partial: boolean;
}

/** Most bars a time split draws before it switches to a coarser one. */
export const MAX_TIME_BUCKETS = 36;
const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 365.25 / 12;

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
const isoOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from) + 1;
/** 1 = Monday … 7 = Sunday. */
const weekday = (iso: string) => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const mondayOf = (iso: string) => isoOf(dayNumber(iso) - (weekday(iso) - 1));
const cents = (value: number) => Math.round(value * 100) / 100 || 0;

function shiftYear(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y + years, m - 1, 1));
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  date.setUTCDate(Math.min(d, last));
  return date.toISOString().slice(0, 10);
}
const isMonthStart = (iso: string) => iso.endsWith("-01");
const isMonthEnd = (iso: string) => isoOf(dayNumber(iso) + 1).endsWith("-01");

/**
 * The span an analysis compares with: the one just before (a whole month or year when the period is one, else the same
 * number of days), or the same days one year earlier.
 */
export function comparisonSpan(from: string, to: string, compare: NonNullable<AnalysisQuery["compare"]>): { from: string; to: string } {
  if (compare === "anno_prima") return { from: shiftYear(from, -1), to: shiftYear(to, -1) };
  if (isMonthStart(from) && isMonthEnd(to)) {
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    const months = (ty - fy) * 12 + (tm - fm) + 1;
    const start = new Date(Date.UTC(fy, fm - 1 - months, 1)).toISOString().slice(0, 10);
    return { from: start, to: isoOf(dayNumber(from) - 1) };
  }
  const length = daysBetween(from, to);
  return { from: isoOf(dayNumber(from) - length), to: isoOf(dayNumber(from) - 1) };
}

/** Whether one movement passes the direction and the filters (not the period). */
function matches(row: AnalysisRow, query: AnalysisQuery, filters: ResolvedFilters, context: AnalysisContext): boolean {
  if (row.amount === 0) return false;
  if (query.direction === "uscite" && row.amount > 0) return false;
  if (query.direction === "entrate" && row.amount < 0) return false;
  const category = context.categories.get(row.categoryId);
  // Transfers between one's own accounts are excluded in full by «Dividi»; a leftover share still is not spending.
  if (category?.type === "trasferimento") return false;
  if (filters.categoryId !== null && row.categoryId !== filters.categoryId) return false;
  if (filters.group !== null && category?.type !== filters.group) return false;
  if (filters.accountId !== null && row.accountId !== filters.accountId) return false;
  const size = Math.abs(row.amount);
  if (filters.min !== null && size < filters.min) return false;
  if (filters.max !== null && size > filters.max) return false;
  if (filters.days !== null && (weekday(row.date) >= 6) !== (filters.days === "weekend")) return false;
  if (filters.text !== "" && !foldText(row.description ?? "").includes(filters.text) && !foldText(row.note ?? "").includes(filters.text)) return false;
  return true;
}

/** Money of a movement as the result counts it: a magnitude, or signed for income minus spending. */
const valueOf = (row: AnalysisRow, query: AnalysisQuery) => (query.direction === "netto" ? row.amount : Math.abs(row.amount));

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** How many months, weeks, days or years an average over time is divided by, from `from` (or the first movement) to `to`. */
function spanUnits(query: AnalysisQuery, from: string, to: string, context: AnalysisContext): number {
  const start = context.firstDay !== null && context.firstDay > from ? context.firstDay : from;
  const end = to > context.today ? context.today : to;
  const days = Math.max(1, daysBetween(start, end));
  switch (query.per) {
    case "giorno":
      return days;
    case "settimana":
      return Math.max(1, days / 7);
    case "mese":
      return Math.max(1, days / DAYS_PER_MONTH);
    case "anno":
      return Math.max(1, days / 365.25);
    default:
      return 1;
  }
}

/** The figure of `query` over `rows` (already filtered to one span): a total, an average, a median, a count. */
function figure(rows: AnalysisRow[], query: AnalysisQuery, units: number): number | null {
  if (rows.length === 0) return query.measure === "conteggio" || query.measure === "somma" ? 0 : null;
  const values = rows.map((row) => valueOf(row, query));
  const total = values.reduce((a, b) => a + b, 0);
  switch (query.measure) {
    case "media":
      return query.per === "movimento" ? total / rows.length : total / units;
    case "mediana":
      return median(values);
    case "conteggio":
      return rows.length;
    case "massimo":
      return Math.max(...values);
    case "minimo":
      return Math.min(...values);
    default:
      return total;
  }
}

/** The split actually drawn: a time split with too many bars becomes the next coarser one. */
function effectiveGroupBy(groupBy: AnalysisGroupBy | null, from: string, to: string): AnalysisGroupBy | null {
  if (groupBy === "settimana" && daysBetween(from, to) / 7 > MAX_TIME_BUCKETS) return effectiveGroupBy("mese", from, to);
  if (groupBy === "mese") {
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    if ((ty - fy) * 12 + (tm - fm) + 1 > MAX_TIME_BUCKETS) return "anno";
  }
  return groupBy;
}

/** Every bucket of a time split between `from` and `to`, empty ones included, oldest first. */
function timeBuckets(groupBy: "mese" | "settimana" | "anno", from: string, to: string): Array<{ key: string; from: string; to: string }> {
  const buckets: Array<{ key: string; from: string; to: string }> = [];
  if (groupBy === "settimana") {
    for (let day = dayNumber(mondayOf(from)); day <= dayNumber(to); day += 7) buckets.push({ key: isoOf(day), from: isoOf(day), to: isoOf(day + 6) });
    return buckets;
  }
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (groupBy === "anno") {
    for (let y = fy; y <= ty; y++) buckets.push({ key: `${y}-01-01`, from: `${y}-01-01`, to: `${y}-12-31` });
    return buckets;
  }
  for (let i = 0; i <= (ty - fy) * 12 + (tm - fm); i++) {
    const start = new Date(Date.UTC(fy, fm - 1 + i, 1));
    const end = new Date(Date.UTC(fy, fm + i, 0));
    buckets.push({ key: start.toISOString().slice(0, 10), from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
  }
  return buckets;
}

function bucketKey(row: AnalysisRow, groupBy: AnalysisGroupBy, context: AnalysisContext): string {
  switch (groupBy) {
    case "categoria":
      return row.categoryId;
    case "gruppo": {
      const category = context.categories.get(row.categoryId);
      if (!category || category.isFallback) return "daCategorizzare";
      return (EXPENSE_GROUP_KEYS as readonly string[]).includes(category.type) ? category.type : category.type;
    }
    case "esercente":
      return foldText(row.description ?? "");
    case "conto":
      return row.accountId;
    case "mese":
      return `${row.date.slice(0, 7)}-01`;
    case "settimana":
      return mondayOf(row.date);
    case "anno":
      return `${row.date.slice(0, 4)}-01-01`;
    case "giorno_settimana":
      return String(weekday(row.date));
  }
}

const LABEL_KINDS: Record<AnalysisGroupBy, AnalysisLabelKind> = {
  categoria: "nome",
  gruppo: "gruppo",
  esercente: "nome",
  conto: "nome",
  mese: "mese",
  settimana: "settimana",
  anno: "anno",
  giorno_settimana: "giorno_settimana",
};

/** A split: one figure per bucket, the rows that make it, newest movement first inside each. */
function split(rows: AnalysisRow[], query: AnalysisQuery, groupBy: AnalysisGroupBy, from: string, to: string, units: number, context: AnalysisContext): AnalysisResultRow[] {
  const byKey = new Map<string, AnalysisRow[]>();
  for (const row of rows) {
    const key = bucketKey(row, groupBy, context);
    const list = byKey.get(key);
    if (list) list.push(row);
    else byKey.set(key, [row]);
  }
  // A ranking of buckets ranks their totals («in quale mese ho speso di più»); otherwise each bucket gets the figure.
  const bucketQuery: AnalysisQuery = query.measure === "massimo" || query.measure === "minimo" || query.measure === "elenco" ? { ...query, measure: "somma" } : query;
  const make = (key: string, list: AnalysisRow[], span?: { from: string; to: string }): AnalysisResultRow => {
    const newest = list.reduce<AnalysisRow | null>((best, row) => (best === null || row.date > best.date ? row : best), null);
    const base: AnalysisResultRow = { key, label: key, labelKind: LABEL_KINDS[groupBy], value: cents(figure(list, bucketQuery, units) ?? 0), count: list.length };
    switch (groupBy) {
      case "categoria":
        return { ...base, label: context.categories.get(key)?.name ?? "", categoryId: key };
      case "conto":
        return { ...base, label: context.accounts.get(key) ?? "", accountId: key };
      case "esercente":
        return { ...base, label: newest?.description ?? key, text: key };
      case "gruppo":
        return base;
      case "giorno_settimana":
        return base;
      default:
        return { ...base, from: span?.from ?? key, to: span?.to ?? key };
    }
  };
  if (TIME_GROUP_BY.has(groupBy)) {
    return timeBuckets(groupBy as "mese" | "settimana" | "anno", from, to).map((bucket) => make(bucket.key, byKey.get(bucket.key) ?? [], bucket));
  }
  if (groupBy === "giorno_settimana") {
    return [1, 2, 3, 4, 5, 6, 7].map((day) => make(String(day), byKey.get(String(day)) ?? []));
  }
  return [...byKey.entries()].map(([key, list]) => make(key, list));
}

/** Computes `query` over `rows` (every movement of the user in the period and, when comparing, the earlier span). */
export function runAnalysis(rows: AnalysisRow[], query: AnalysisQuery, filters: ResolvedFilters, context: AnalysisContext): AnalysisResult {
  const { from, to } = query;
  const matched = rows.filter((row) => matches(row, query, filters, context));
  const inPeriod = matched.filter((row) => row.date >= from && row.date <= to);
  const units = spanUnits(query, from, to, context);
  const groupBy = effectiveGroupBy(query.groupBy, from, to);
  const total = cents(inPeriod.reduce((acc, row) => acc + valueOf(row, query), 0));
  const readsText = filters.text !== "" || groupBy === "esercente";
  const partial = readsText && context.textFrom !== null && from < context.textFrom;
  const unit = query.measure === "conteggio" ? "volte" : "denaro";
  const base = { unit, count: inPeriod.length, total, span: query.measure === "media" && query.per !== "movimento" ? Math.round(units * 10) / 10 : null, from, to, groupBy, partial } as const;

  let comparison: AnalysisResult["comparison"] = null;
  if (query.compare) {
    const span = comparisonSpan(from, to, query.compare);
    const earlier = matched.filter((row) => row.date >= span.from && row.date <= span.to);
    const value = figure(earlier, query.measure === "elenco" ? { ...query, measure: "somma" } : query, spanUnits(query, span.from, span.to, context));
    comparison = { value: value === null ? null : cents(value), ...span };
  }

  // An average per month without a split still shows its months, so the figure has its shape beside it.
  const implicitSeries = groupBy === null && query.measure === "media" && query.per === "mese" ? effectiveGroupBy("mese", from, to) : null;
  if (groupBy !== null || implicitSeries !== null) {
    const by = (groupBy ?? implicitSeries)!;
    const buckets = split(inPeriod, implicitSeries ? { ...query, measure: "somma" } : query, by, from, to, units, context);
    const time = TIME_GROUP_BY.has(by) || by === "giorno_settimana";
    const nonEmpty = buckets.filter((b) => b.count > 0);
    const ranked = [...nonEmpty].sort((a, b) => (query.order === "asc" ? a.value - b.value : b.value - a.value));
    // Time stays in time order (a bar chart, the winner lit); names are ranked, biggest first, the rest summed.
    const shown = time ? buckets : ranked.slice(0, query.limit);
    const rest = time ? [] : ranked.slice(query.limit);
    const top = groupBy !== null && (query.measure === "massimo" || query.measure === "minimo") ? (ranked[0] ?? null) : null;
    const overall = top ? top.value : inPeriod.length === 0 ? null : figure(inPeriod, query.measure === "elenco" ? { ...query, measure: "somma" } : query, units);
    return {
      ...base,
      value: overall === null ? null : cents(overall),
      top,
      rows: shown,
      rowsKind: time ? "serie" : "gruppi",
      others: rest.length > 0 ? { value: cents(rest.reduce((a, b) => a + b.value, 0)), count: rest.reduce((a, b) => a + b.count, 0), groups: rest.length } : null,
      comparison,
    };
  }

  // Without a split, the biggest, the smallest and a list show the movements themselves.
  if (query.measure === "massimo" || query.measure === "minimo" || query.measure === "elenco") {
    const ordered = [...inPeriod].sort((a, b) =>
      query.measure === "elenco" ? b.date.localeCompare(a.date) : query.order === "asc" ? valueOf(a, query) - valueOf(b, query) : valueOf(b, query) - valueOf(a, query)
    );
    const shown = ordered.slice(0, query.limit).map<AnalysisResultRow>((row) => ({
      key: row.id,
      label: row.description ?? "",
      labelKind: "nome",
      value: cents(valueOf(row, query)),
      count: 1,
      date: row.date,
      movementId: row.id,
    }));
    const value = query.measure === "elenco" ? (inPeriod.length === 0 ? null : total) : (shown[0]?.value ?? null);
    return { ...base, value, top: null, rows: shown, rowsKind: "movimenti", others: null, comparison };
  }

  const value = figure(inPeriod, query, units);
  return { ...base, value: value === null || (inPeriod.length === 0 && query.measure !== "conteggio") ? (query.measure === "conteggio" ? 0 : null) : cents(value), top: null, rows: [], rowsKind: null, others: null, comparison };
}
