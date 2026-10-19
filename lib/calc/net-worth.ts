import { endOfMonth, parseDateOnly, startOfDay, type DateRange } from "./expenses";

/** Maximum depth of the reconstructed cash history, in months (see `lib/calc/cash-history.ts`). */
export const MAX_DERIVED_HISTORY_MONTHS = 24;

/** Chiave "YYYY-MM-DD" della data locale, confrontabile come stringa. */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Somma `days` giorni di calendario (anche negativi) a mezzanotte locale. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Periodo selezionabile nel grafico del patrimonio netto. */
export type NetWorthPeriod = "1mese" | "3mesi" | "1anno" | "max";

const PERIOD_MONTHS: Record<Exclude<NetWorthPeriod, "max">, number> = {
  "1mese": 1,
  "3mesi": 3,
  "1anno": 12,
};

/** Riga di snapshot come arriva dall'API (numeric serializzato come stringa). */
export interface NetWorthSnapshotInput {
  date: string;
  amount: string;
  source: string;
  assetClass: string;
}

/** Valore per classe di asset (chiave = `assetClass`, es. "liquidita", "investimenti"). */
export type NetWorthByClass = Record<string, number>;

/**
 * Punto del grafico: `value` è il totale, `byClass` la sua divisione per classe di asset (la somma coincide con
 * `value`); `isEstimated` indica che almeno una classe è ricostruita dalle transazioni.
 */
export interface NetWorthSeriesPoint {
  date: string;
  label: string;
  value: number;
  byClass: NetWorthByClass;
  isEstimated: boolean;
}

/** Copia della serie con il totale (`value`) senza una classe di asset: `byClass` resta intatto, per mostrarla comunque nel grafico. */
export function excludeClassFromSeries(series: NetWorthSeriesPoint[], classKey: string): NetWorthSeriesPoint[] {
  return series.map((point) => ({ ...point, value: point.value - (point.byClass[classKey] ?? 0) }));
}

/** Copia della serie con il totale (`value`) ricalcolato sulle sole classi indicate; `byClass` resta intatto, così le altre si possono ancora mostrare. */
export function restrictSeriesToClasses(series: NetWorthSeriesPoint[], classKeys: string[]): NetWorthSeriesPoint[] {
  return series.map((point) => ({
    ...point,
    value: classKeys.reduce((sum, key) => sum + (point.byClass[key] ?? 0), 0),
  }));
}

/** Variazione tra primo e ultimo punto; `deltaPct` è un rapporto (0.5 = +50%). */
export interface NetWorthChange {
  start: number;
  end: number;
  delta: number;
  deltaPct: number | null;
}

interface ClassValue {
  value: number;
  isEstimated: boolean;
}


function subtractMonthsClamped(date: Date, months: number): Date {
  const firstOfTarget = new Date(date.getFullYear(), date.getMonth() - months, 1);
  const lastDay = endOfMonth(firstOfTarget).getDate();
  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Intervallo del periodo fino a oggi; `max` parte dalla prima data disponibile (o da oggi se non ce ne sono). */
export function getNetWorthPeriodRange(period: NetWorthPeriod, today: Date, earliestDate: string | null): DateRange {
  const to = startOfDay(today);
  if (period === "max") {
    return { from: earliestDate ? parseDateOnly(earliestDate) : to, to };
  }
  return { from: subtractMonthsClamped(to, PERIOD_MONTHS[period]), to };
}

/**
 * Serie del patrimonio netto nel periodo, divisa per classe di asset. Ogni classe ripete il proprio ultimo valore nei
 * giorni in cui manca (così un giorno con la sola riga di liquidità non fa sparire gli investimenti); il punto di oggi
 * usa i valori correnti `todayByClass`. Giornaliera per 1mese/3mesi, un punto per fine mese per 1anno/max.
 */
export function buildNetWorthSeries(
  snapshots: NetWorthSnapshotInput[],
  todayByClass: NetWorthByClass,
  period: NetWorthPeriod,
  today: Date,
  locale = "it-IT"
): NetWorthSeriesPoint[] {
  const dayLabelFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const monthLabelFormat = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" });
  const todayKey = toDateKey(startOfDay(today));
  const byDate = new Map<string, Map<string, ClassValue>>();
  for (const row of snapshots) {
    if (row.date >= todayKey) continue;
    const classes = byDate.get(row.date) ?? new Map<string, ClassValue>();
    const current = classes.get(row.assetClass) ?? { value: 0, isEstimated: false };
    classes.set(row.assetClass, {
      value: current.value + Number(row.amount),
      isEstimated: current.isEstimated || row.source === "derivato",
    });
    byDate.set(row.date, classes);
  }

  const sortedKeys = [...byDate.keys()].sort();
  const range = getNetWorthPeriodRange(period, today, sortedKeys[0] ?? null);
  const fromKey = toDateKey(range.from);

  const last = new Map<string, ClassValue>();
  const carry = (key: string) => {
    for (const [assetClass, value] of byDate.get(key) ?? []) last.set(assetClass, value);
  };
  for (const key of sortedKeys) {
    if (key >= fromKey) break;
    carry(key);
  }

  const daily: NetWorthSeriesPoint[] = [];
  for (let cursor = range.from; toDateKey(cursor) < todayKey; cursor = addDays(cursor, 1)) {
    const key = toDateKey(cursor);
    carry(key);
    if (last.size > 0) {
      const byClass: NetWorthByClass = {};
      let value = 0;
      let isEstimated = false;
      for (const [assetClass, entry] of last) {
        byClass[assetClass] = entry.value;
        value += entry.value;
        isEstimated ||= entry.isEstimated;
      }
      daily.push({ date: key, label: dayLabelFormat.format(cursor), value: round2(value), byClass, isEstimated });
    }
  }
  const todayValue = Object.values(todayByClass).reduce((sum, v) => sum + v, 0);
  daily.push({
    date: todayKey,
    label: dayLabelFormat.format(startOfDay(today)),
    value: round2(todayValue),
    byClass: { ...todayByClass },
    isEstimated: false,
  });

  if (period === "1mese" || period === "3mesi") return daily;

  const monthly: NetWorthSeriesPoint[] = [];
  for (const p of daily) {
    const relabeled = { ...p, label: monthLabelFormat.format(parseDateOnly(p.date)) };
    const previous = monthly[monthly.length - 1];
    if (previous && previous.date.slice(0, 7) === p.date.slice(0, 7)) {
      monthly[monthly.length - 1] = relabeled;
    } else {
      monthly.push(relabeled);
    }
  }
  return monthly;
}

/** Variazione del patrimonio tra primo e ultimo punto della serie; percentuale nulla con meno di 2 punti o partenza a zero. */
export function computeNetWorthChange(series: NetWorthSeriesPoint[]): NetWorthChange {
  if (series.length === 0) return { start: 0, end: 0, delta: 0, deltaPct: null };
  const start = series[0].value;
  const end = series[series.length - 1].value;
  const delta = end - start;
  const deltaPct = series.length >= 2 && start !== 0 ? delta / Math.abs(start) : null;
  return { start, end, delta, deltaPct };
}
