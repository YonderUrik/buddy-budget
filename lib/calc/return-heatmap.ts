/**
 * Heatmap dei rendimenti: i rendimenti giornalieri (TWR) raggruppati per giorno, settimana, mese o anno e disposti
 * in una griglia, come un calendario delle attività. Ogni casella concatena i rendimenti dei suoi giorni, quindi
 * non dipende da quanto si è versato. Logica pura: la UI riceve righe e colonne pronte.
 */

import { parseDateOnly } from "./expenses";
import { addDays, toDateKey } from "./net-worth";
import type { DailyReturn } from "./returns";

export const HEATMAP_GROUPINGS = ["giorno", "settimana", "mese", "anno"] as const;
export type HeatmapGrouping = (typeof HEATMAP_GROUPINGS)[number];

/** Giorni mostrati nella vista per giorno (un anno, come un calendario delle attività). */
export const HEATMAP_DAY_WINDOW = 364;
/** Percentile dei rendimenti (in valore assoluto) che vale l'intensità piena: pochi giorni estremi non appiattiscono gli altri. */
export const HEATMAP_SCALE_PERCENTILE = 0.9;
/** Sotto questo rendimento (0,05%) una casella è "piatta": colore neutro. */
export const HEATMAP_FLAT_THRESHOLD = 0.0005;
/** Livelli di intensità del colore oltre al neutro. */
export const HEATMAP_LEVELS = 4;

const WEEKDAY_LABELS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const MONTH_SHORT = new Intl.DateTimeFormat("it-IT", { month: "short" });
const MONTH_LONG = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
const DAY_LONG = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
const DAY_SHORT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

/** Una casella: rendimento e guadagno del gruppo di giorni, null se in quei giorni non c'era niente investito. */
export interface HeatmapCell {
  key: string;
  /** Descrizione per il dettaglio al passaggio ("marzo 2026", "settimana dal 2 mar 2026"). */
  label: string;
  ret: number | null;
  gain: number | null;
  /** Livello di colore: 0 neutro, da 1 a `HEATMAP_LEVELS` sempre più intenso. */
  level: number;
}

export interface HeatmapRow {
  label: string;
  /** Una casella per colonna; null dove il gruppo non esiste (prima della prima operazione o nel futuro). */
  cells: (HeatmapCell | null)[];
  /** Totale della riga (solo per la vista per mese: l'anno). */
  total?: HeatmapCell | null;
}

export interface ReturnHeatmap {
  grouping: HeatmapGrouping;
  /** Etichette delle colonne; stringa vuota dove non serve un'etichetta. */
  columns: string[];
  rows: HeatmapRow[];
  /** Rendimento che vale l'intensità piena. */
  scale: number;
  /** Gruppi in guadagno e in perdita (oltre la soglia di "piatto") e gruppi con un rendimento. */
  positive: number;
  negative: number;
  counted: number;
}

interface Bucket {
  key: string;
  label: string;
  factor: number;
  gain: number;
  hasReturn: boolean;
}

function mondayOf(date: Date): Date {
  const weekday = (date.getDay() + 6) % 7;
  return addDays(date, -weekday);
}

/** Numero della settimana ISO (1-53) e anno a cui appartiene. */
export function isoWeek(date: Date): { year: number; week: number } {
  const thursday = addDays(mondayOf(date), 3);
  const year = thursday.getFullYear();
  const firstThursday = addDays(mondayOf(new Date(year, 0, 4)), 3);
  const week = Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000)) + 1;
  return { year, week };
}

function bucketKeyOf(dateKey: string, grouping: HeatmapGrouping): { key: string; label: string } {
  const date = parseDateOnly(dateKey);
  if (grouping === "giorno") return { key: dateKey, label: DAY_LONG.format(date) };
  if (grouping === "settimana") {
    const { year, week } = isoWeek(date);
    return { key: `${year}-W${String(week).padStart(2, "0")}`, label: `Settimana dal ${DAY_SHORT.format(mondayOf(date))} ${mondayOf(date).getFullYear()}` };
  }
  if (grouping === "mese") return { key: dateKey.slice(0, 7), label: MONTH_LONG.format(date) };
  return { key: dateKey.slice(0, 4), label: dateKey.slice(0, 4) };
}

/** Raggruppa i rendimenti giornalieri: ogni gruppo concatena i rendimenti dei suoi giorni e somma i guadagni. */
export function groupDailyReturns(daily: DailyReturn[], grouping: HeatmapGrouping): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();
  for (const day of daily) {
    const { key, label } = bucketKeyOf(day.date, grouping);
    const bucket = buckets.get(key) ?? { key, label, factor: 1, gain: 0, hasReturn: false };
    if (day.ret !== null) {
      bucket.factor *= 1 + day.ret;
      bucket.gain += day.gain;
      bucket.hasReturn = true;
    }
    buckets.set(key, bucket);
  }
  return buckets;
}

/** Valore al percentile `p` (0-1) di numeri già ordinati. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

/** Livello di colore di un rendimento rispetto alla scala. */
export function heatmapLevel(ret: number | null, scale: number): number {
  if (ret === null || Math.abs(ret) < HEATMAP_FLAT_THRESHOLD || scale <= 0) return 0;
  return Math.max(1, Math.min(HEATMAP_LEVELS, Math.ceil((Math.abs(ret) / scale) * HEATMAP_LEVELS)));
}

function toCell(bucket: Bucket | undefined): HeatmapCell | null {
  if (!bucket) return null;
  return { key: bucket.key, label: bucket.label, ret: bucket.hasReturn ? bucket.factor - 1 : null, gain: bucket.hasReturn ? bucket.gain : null, level: 0 };
}

function yearsBetween(firstKey: string, lastKey: string): number[] {
  const years: number[] = [];
  for (let y = Number(lastKey.slice(0, 4)); y >= Number(firstKey.slice(0, 4)); y -= 1) years.push(y);
  return years;
}

/** Griglia per giorno: colonne = settimane dell'ultimo anno, righe = giorni della settimana. */
function dayGrid(buckets: Map<string, Bucket>, todayKey: string): Pick<ReturnHeatmap, "columns" | "rows"> {
  const today = parseDateOnly(todayKey);
  const start = mondayOf(addDays(today, -HEATMAP_DAY_WINDOW));
  const weeks = Math.floor((today.getTime() - start.getTime()) / (7 * 86_400_000)) + 1;
  const columns: string[] = [];
  const rows: HeatmapRow[] = WEEKDAY_LABELS.map((label) => ({ label, cells: [] }));
  let lastMonth = -1;
  let lastLabelColumn = -Infinity;
  for (let w = 0; w < weeks; w += 1) {
    const monday = addDays(start, w * 7);
    // Un'etichetta per mese, ma non attaccata alla precedente (il primo mese può avere una sola settimana).
    const labelled = monday.getMonth() !== lastMonth && w - lastLabelColumn >= MIN_LABEL_GAP_COLUMNS;
    columns.push(labelled ? MONTH_SHORT.format(monday) : "");
    if (labelled) lastLabelColumn = w;
    lastMonth = monday.getMonth();
    for (let d = 0; d < 7; d += 1) {
      const key = toDateKey(addDays(monday, d));
      rows[d].cells.push(key > todayKey ? null : toCell(buckets.get(key)));
    }
  }
  return { columns, rows };
}

/** Griglia per settimana: righe = anni (dal più recente), colonne = settimane ISO 1-53. */
function weekGrid(buckets: Map<string, Bucket>, firstKey: string, todayKey: string): Pick<ReturnHeatmap, "columns" | "rows"> {
  const columns = Array.from({ length: 53 }, (_, i) => ((i + 1) % 4 === 1 ? String(i + 1) : ""));
  const rows = yearsBetween(firstKey, todayKey).map((year) => ({
    label: String(year),
    cells: Array.from({ length: 53 }, (_, i) => toCell(buckets.get(`${year}-W${String(i + 1).padStart(2, "0")}`))),
  }));
  return { columns, rows };
}

/** Griglia per mese: righe = anni (dal più recente), 12 colonne più il totale dell'anno. */
function monthGrid(buckets: Map<string, Bucket>, yearBuckets: Map<string, Bucket>, firstKey: string, todayKey: string): Pick<ReturnHeatmap, "columns" | "rows"> {
  const columns = Array.from({ length: 12 }, (_, i) => MONTH_SHORT.format(new Date(2026, i, 1)));
  const rows = yearsBetween(firstKey, todayKey).map((year) => ({
    label: String(year),
    cells: Array.from({ length: 12 }, (_, i) => toCell(buckets.get(`${year}-${String(i + 1).padStart(2, "0")}`))),
    total: toCell(yearBuckets.get(String(year))),
  }));
  return { columns, rows };
}

/** Griglia per anno: una riga, una colonna per anno (dal più vecchio). */
function yearGrid(buckets: Map<string, Bucket>, firstKey: string, todayKey: string): Pick<ReturnHeatmap, "columns" | "rows"> {
  const years = yearsBetween(firstKey, todayKey).reverse();
  return { columns: years.map(String), rows: [{ label: "", cells: years.map((y) => toCell(buckets.get(String(y)))) }] };
}

/**
 * Heatmap dei rendimenti. `daily` sono i rendimenti di ogni giorno dalla prima operazione a oggi. Il colore di ogni
 * casella dipende dal suo rendimento rispetto alla scala (il 90° percentile dei rendimenti della griglia).
 */
export function buildReturnHeatmap(daily: DailyReturn[], grouping: HeatmapGrouping, todayKey: string): ReturnHeatmap | null {
  const firstKey = daily.find((d) => d.ret !== null)?.date;
  if (!firstKey) return null;
  const relevant = daily.filter((d) => d.date >= firstKey && d.date <= todayKey);
  const buckets = groupDailyReturns(relevant, grouping);
  const grid =
    grouping === "giorno"
      ? dayGrid(buckets, todayKey)
      : grouping === "settimana"
        ? weekGrid(buckets, firstKey, todayKey)
        : grouping === "mese"
          ? monthGrid(buckets, groupDailyReturns(relevant, "anno"), firstKey, todayKey)
          : yearGrid(buckets, firstKey, todayKey);

  // Nella vista per giorno il weekend si nasconde se non si è mai mosso (mercati chiusi); con le crypto resta.
  if (grouping === "giorno") grid.rows = grid.rows.filter((row, i) => i < WEEKEND_START || row.cells.some(isMoving));
  const cells = grid.rows.flatMap((r) => r.cells).filter((c): c is HeatmapCell => c !== null && c.ret !== null);
  const scale = percentile(cells.filter(isMoving).map((c) => Math.abs(c.ret!)).sort((a, b) => a - b), HEATMAP_SCALE_PERCENTILE);
  for (const row of grid.rows) {
    for (const cell of [...row.cells, row.total ?? null]) {
      if (cell) cell.level = heatmapLevel(cell.ret, scale);
    }
  }
  const positive = cells.filter((c) => c.ret! >= HEATMAP_FLAT_THRESHOLD).length;
  const negative = cells.filter((c) => c.ret! <= -HEATMAP_FLAT_THRESHOLD).length;
  return { grouping, ...grid, scale, positive, negative, counted: cells.length };
}

/** Colonne minime tra due etichette di mese nella vista per giorno. */
const MIN_LABEL_GAP_COLUMNS = 3;

/** Indice del sabato nelle righe della vista per giorno. */
const WEEKEND_START = 5;

/** Una casella con un rendimento non piatto. */
function isMoving(cell: HeatmapCell | null): boolean {
  return cell !== null && cell.ret !== null && Math.abs(cell.ret) >= HEATMAP_FLAT_THRESHOLD;
}
