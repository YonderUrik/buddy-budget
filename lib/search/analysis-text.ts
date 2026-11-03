/**
 * Words of an analysis card in «Cerca», written in the user's language from the question and the figures the server
 * computed: what the figure is («Media al mese», «Quante volte»), the figure itself, how it was made («48 movimenti · su
 * 12 mesi»), the change from an earlier span, and «Cosa ho capito» (one chip per thing read in the question, so a wrong
 * reading shows at a glance). Pure: the card and the tests use it. Amounts go through `formatCurrency`, so they hide
 * with the «nascondi importi» button.
 */

import { EXPENSE_GROUPS, type ExpenseGroup } from "@/lib/categories/groups";
import type { AnalysisGroupBy, AnalysisQuery } from "@/lib/commands/analysis";
import { formatCurrency, formatDateWithYear } from "@/lib/format";
import type { AnalysisLabelKind } from "./analysis-engine";
import type { SearchAnswer } from "./types";

export type AnalysisAnswer = Extract<SearchAnswer, { kind: "analisi" }>;
export type AnalysisTranslate = (key: string, values?: Record<string, string>) => string;

const AVERAGE_TITLES: Record<AnalysisQuery["per"], string> = {
  movimento: "Media per movimento",
  giorno: "Media al giorno",
  settimana: "Media alla settimana",
  mese: "Media al mese",
  anno: "Media all'anno",
};

/** «su 12 mesi»: what an average over time was divided by. */
const SPAN_LINES: Record<AnalysisQuery["per"], string | null> = { movimento: null, giorno: "su {0} giorni", settimana: "su {0} settimane", mese: "su {0} mesi", anno: "su {0} anni" };

const GROUP_BY_LABELS: Record<AnalysisGroupBy, string> = {
  categoria: "Per categoria",
  gruppo: "Per gruppo di spesa",
  esercente: "Per esercente",
  conto: "Per conto",
  mese: "Per mese",
  settimana: "Per settimana",
  giorno_settimana: "Per giorno della settimana",
  anno: "Per anno",
};

const DIRECTION_LABELS: Record<AnalysisQuery["direction"], string> = { uscite: "Uscite", entrate: "Entrate", netto: "Entrate meno uscite" };

/** Group labels beyond the four spending groups (a split by group of income or uncategorised movements). */
const OTHER_GROUP_LABELS: Record<string, string> = { entrata: "Entrate", daCategorizzare: "Da categorizzare" };

/** The sign a money figure is shown with: spending negative, as everywhere in the app; income minus spending as computed. */
export function signed(answer: AnalysisAnswer, value: number): number {
  return answer.query.direction === "uscite" ? -value : value;
}

/** The figure written out: money, or «23 volte». */
export function formatFigure(answer: AnalysisAnswer, value: number, currency: string, locale: string, tr: AnalysisTranslate): string {
  if (answer.result.unit === "volte") return value === 1 ? tr("1 volta") : tr("{0} volte", { 0: new Intl.NumberFormat(locale).format(value) });
  return formatCurrency(signed(answer, value), currency, { locale });
}

/** A period as a person says it: «ottobre 2026», «2026», «da sempre», «ultimi 12 mesi», or «1 mag – 3 nov 2026». */
export function analysisPeriodLabel(query: Pick<AnalysisQuery, "from" | "to" | "all" | "defaultPeriod">, locale: string, tr: AnalysisTranslate, today: string): string {
  if (query.all) return tr("Da sempre");
  if (query.defaultPeriod) return tr("Ultimi 12 mesi");
  return spanLabel(query.from, query.to, locale, tr, today);
}

/** A span of days as a person says it (also for the earlier span of a comparison). */
export function spanLabel(from: string, to: string, locale: string, tr: AnalysisTranslate, today: string): string {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);
  const wholeEnd = to === monthEnd || to === today;
  if (from.endsWith("-01") && wholeEnd && fy === ty && fm === tm) return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(fy, fm - 1, 1));
  if (from.endsWith("-01-01") && fy === ty && (to.endsWith("-12-31") || to === today)) return to === today && !to.endsWith("-12-31") ? tr("{0} fino a oggi", { 0: String(fy) }) : String(fy);
  if (from.endsWith("-01") && wholeEnd) {
    const month = (y: number, m: number) => new Intl.DateTimeFormat(locale, { month: "short", year: fy === ty ? undefined : "numeric" }).format(new Date(y, m - 1, 1));
    return fy === ty ? `${month(fy, fm)} – ${month(ty, tm)} ${ty}` : `${month(fy, fm)} – ${month(ty, tm)}`;
  }
  return `${formatDateWithYear(from, locale)} – ${formatDateWithYear(to, locale)}`;
}

/** What the figure is, above it. A «which month / which category» question names the winner instead. */
export function analysisTitle(answer: AnalysisAnswer, locale: string, tr: AnalysisTranslate): string {
  const { query, result } = answer;
  if (result.top) return rowLabel(result.top.label, result.top.labelKind, locale, tr);
  switch (query.measure) {
    case "media":
      return tr(AVERAGE_TITLES[query.per]);
    case "mediana":
      return tr("Mediana di un movimento");
    case "conteggio":
      return tr("Quante volte");
    case "massimo":
      return tr("I movimenti più grandi");
    case "minimo":
      return tr("I movimenti più piccoli");
    case "elenco":
      return tr("Movimenti trovati");
    default:
      return tr(DIRECTION_LABELS[query.direction]);
  }
}

/** A short line above the title of a winner: «Il più alto» or «Il più basso». */
export function analysisKicker(answer: AnalysisAnswer, tr: AnalysisTranslate): string | null {
  if (!answer.result.top) return null;
  return tr(answer.query.order === "asc" ? "Il più basso" : "Il più alto");
}

/** How the figure was made, under it, or why there is none. */
export function analysisLine(answer: AnalysisAnswer, locale: string, tr: AnalysisTranslate, currency = "EUR"): string {
  const { result, names, query } = answer;
  if (names.missingAccount) return tr("Non trovo un conto «{0}»", { 0: names.missingAccount });
  if (result.count === 0) return tr("Nessun movimento così nel periodo");
  const count = result.top ? result.top.count : result.count;
  const parts: string[] = [];
  // A count already says how many: what they add up to instead. The biggest or smallest: out of how many.
  if (query.measure === "conteggio") parts.push(tr("{0} in tutto", { 0: formatCurrency(signed(answer, result.total), currency, { locale }) }));
  else if (result.rowsKind === "movimenti" && query.measure !== "elenco") parts.push(tr(query.order === "asc" ? "il più piccolo di {0} movimenti" : "il più grande di {0} movimenti", { 0: String(result.count) }));
  else parts.push(count === 1 ? tr("1 movimento") : tr("{0} movimenti", { 0: String(count) }));
  if (result.span !== null) {
    const span = new Intl.NumberFormat(locale, { maximumFractionDigits: result.span >= 10 ? 0 : 1 }).format(result.span);
    const key = SPAN_LINES[answer.query.per];
    if (key) parts.push(tr(key, { 0: span }));
  }
  if (result.top) parts.push(tr("il primo di {0}", { 0: String(result.rows.filter((r) => r.count > 0).length + (result.others?.groups ?? 0)) }));
  if (result.partial) parts.push(tr("solo gli ultimi 24 mesi"));
  return parts.join(" · ");
}

/** The change from the earlier span: «18% in più rispetto a ottobre 2025», and whether it is good news. */
export function analysisComparison(answer: AnalysisAnswer, locale: string, tr: AnalysisTranslate, today: string): { text: string; tone: "pos" | "neg" | "neutral" } | null {
  const { result, query } = answer;
  const comparison = result.comparison;
  if (!comparison || result.value === null) return null;
  const when = spanLabel(comparison.from, comparison.to, locale, tr, today);
  if (comparison.value === null || comparison.value === 0) return { text: tr("Niente da confrontare in {0}", { 0: when }), tone: "neutral" };
  const change = (result.value - comparison.value) / Math.abs(comparison.value);
  if (Math.abs(change) < 0.005) return { text: tr("Come in {0}", { 0: when }), tone: "neutral" };
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: Math.abs(change) < 0.1 ? 1 : 0 }).format(Math.abs(change));
  const more = change > 0;
  // More spending is bad news; more income or more saved is good news; a count says nothing either way.
  const tone = result.unit === "volte" ? "neutral" : (query.direction === "uscite") === more ? "neg" : "pos";
  return { text: tr(more ? "{0} in più rispetto a {1}" : "{0} in meno rispetto a {1}", { 0: pct, 1: when }), tone };
}

/** A split row's name: a category, merchant or account as it is called, a group, a month, a week, a weekday, a year. */
export function rowLabel(label: string, kind: AnalysisLabelKind, locale: string, tr: AnalysisTranslate): string {
  switch (kind) {
    case "gruppo":
      return tr(EXPENSE_GROUPS[label as ExpenseGroup]?.label ?? OTHER_GROUP_LABELS[label] ?? label);
    case "mese": {
      const [y, m] = label.split("-").map(Number);
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
    }
    case "settimana":
      return tr("Settimana del {0}", { 0: formatDateWithYear(label, locale) });
    case "anno":
      return label.slice(0, 4);
    case "giorno_settimana":
      // 2024-01-01 was a Monday: day `n` is 2024-01-0n.
      return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2024, 0, Number(label)));
    default:
      return label;
  }
}

/** The short tick under a bar of a time split: «ott», «2025», «12/10». */
export function barTick(label: string, kind: AnalysisLabelKind, locale: string): string {
  const [y, m, d] = label.split("-").map(Number);
  if (kind === "anno") return String(y);
  if (kind === "settimana") return new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric" }).format(new Date(y, m - 1, d));
  if (kind === "giorno_settimana") return new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2024, 0, Number(label)));
  return new Intl.DateTimeFormat(locale, { month: "narrow" }).format(new Date(y, m - 1, 1));
}

/** «Cosa ho capito»: one chip per thing read in the question, in the order a person would say them. */
export function analysisChips(answer: AnalysisAnswer, currency: string, locale: string, tr: AnalysisTranslate, today: string): string[] {
  const { query, names } = answer;
  const { filters } = query;
  const money = (value: number) => formatCurrency(value, currency, { locale, maximumFractionDigits: 0 });
  const chips = [tr(DIRECTION_LABELS[query.direction])];
  if (names.category) chips.push(names.category);
  // Words looked for in the movements, as typed (folded): quoted, so they read as a search.
  const words = filters.text || (!names.category ? filters.category : "");
  if (words) chips.push(`«${words}»`);
  if (filters.group) chips.push(tr(EXPENSE_GROUPS[filters.group].label));
  if (names.account) chips.push(names.account);
  if (filters.min !== null && filters.max !== null) chips.push(tr("Tra {0} e {1}", { 0: money(filters.min), 1: money(filters.max) }));
  else if (filters.min !== null) chips.push(tr("Sopra {0}", { 0: money(filters.min) }));
  else if (filters.max !== null) chips.push(tr("Sotto {0}", { 0: money(filters.max) }));
  if (filters.days) chips.push(tr(filters.days === "weekend" ? "Solo nel weekend" : "Solo nei giorni feriali"));
  chips.push(analysisPeriodLabel(query, locale, tr, today));
  if (answer.result.groupBy) chips.push(tr(GROUP_BY_LABELS[answer.result.groupBy]));
  if (query.compare) chips.push(tr(query.compare === "anno_prima" ? "Rispetto all'anno prima" : "Rispetto al periodo prima"));
  return chips;
}

/** Whether the card has a figure worth showing (else «Chiedi all'AI» stays offered with what was read). */
export function isUsefulAnalysis(answer: AnalysisAnswer): boolean {
  return answer.result.value !== null && answer.names.missingAccount === null;
}
