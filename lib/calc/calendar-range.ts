/**
 * Pure helpers behind the shared period selector: calendar grids, range picking by tapping two dates, and the short
 * label of a chosen range. Keys are strings that sort chronologically: `YYYY-MM-DD` for days, `YYYY-MM` for months.
 */

export type RangeGranularity = "day" | "month";

/** A range being picked: `to` is null after the first tap, until the second one. */
export interface RangeDraft {
  from: string;
  to: string | null;
}

export interface CalendarDay {
  key: string;
  day: number;
  /** False for the leading/trailing days of the neighbouring months that fill the grid. */
  inMonth: boolean;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `YYYY-MM-DD` of a local date. */
export function dayKey(year: number, monthIndex: number, day: number): string {
  const date = new Date(year, monthIndex, day);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM` of a year and zero-based month, normalising overflow (month 12 is January of the next year). */
export function monthKey(year: number, monthIndex: number): string {
  const date = new Date(year, monthIndex, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Year and zero-based month of a day or month key. */
export function parseMonth(key: string): { year: number; monthIndex: number } {
  return { year: Number(key.slice(0, 4)), monthIndex: Number(key.slice(5, 7)) - 1 };
}

/** Shift a day key by whole days (keyboard navigation in the grid). */
export function addDaysKey(key: string, days: number): string {
  const { year, monthIndex } = parseMonth(key);
  return dayKey(year, monthIndex, Number(key.slice(8, 10)) + days);
}

/** Six Monday-first weeks covering the month: a fixed height, so the sheet does not jump between months. */
export function monthGrid(year: number, monthIndex: number): CalendarDay[] {
  const first = new Date(year, monthIndex, 1);
  const lead = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthIndex, 1 - lead + index);
    return { key: dayKey(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), inMonth: date.getMonth() === ((monthIndex % 12) + 12) % 12 };
  });
}

/**
 * Next draft after tapping `key`: the first tap starts a new range, the second closes it. A second tap before the start
 * moves the start instead, so the range never ends before it begins.
 */
export function pickRange(draft: RangeDraft, key: string): RangeDraft {
  if (draft.to !== null) return { from: key, to: null };
  return key >= draft.from ? { from: draft.from, to: key } : { from: key, to: null };
}

/** Whether `key` falls inside the draft (both ends included); a half-picked draft only contains its start. */
export function inDraft(draft: RangeDraft, key: string): boolean {
  return draft.to === null ? key === draft.from : key >= draft.from && key <= draft.to;
}

/** Length of a range in its own unit, both ends included (days or months). */
export function rangeSpan(from: string, to: string, granularity: RangeGranularity): number {
  const a = parseMonth(from);
  const b = parseMonth(to);
  if (granularity === "month") return (b.year - a.year) * 12 + (b.monthIndex - a.monthIndex) + 1;
  const start = Date.UTC(a.year, a.monthIndex, Number(from.slice(8, 10)));
  const end = Date.UTC(b.year, b.monthIndex, Number(to.slice(8, 10)));
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Key outside [min, max]: such dates are shown but cannot be tapped. */
export function outOfBounds(key: string, min: string | undefined, max: string | undefined): boolean {
  return (min !== undefined && key < min) || (max !== undefined && key > max);
}

/** Month of a key, as `YYYY-MM`. */
export const toMonthOf = (key: string) => key.slice(0, 7);

/**
 * Short label of a range for the selector («3 mar – 17 ott», «gen 2025 – dic 2025»). The year is written only when it
 * is not the current one or the two ends are in different years, so the label stays short in the common case.
 */
export function shortRangeLabel(from: string, to: string, granularity: RangeGranularity, locale: string, currentYear: number): string {
  const a = parseMonth(from);
  const b = parseMonth(to);
  const withYear = a.year !== b.year || b.year !== currentYear;
  if (granularity === "month") {
    const format = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
    const one = format.format(new Date(a.year, a.monthIndex, 1));
    return from === to ? one : `${one} – ${format.format(new Date(b.year, b.monthIndex, 1))}`;
  }
  const format = new Intl.DateTimeFormat(locale, withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  const one = format.format(new Date(a.year, a.monthIndex, Number(from.slice(8, 10))));
  return from === to ? one : `${one} – ${format.format(new Date(b.year, b.monthIndex, Number(to.slice(8, 10))))}`;
}
