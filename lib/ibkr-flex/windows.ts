import type { IbkrFlexPeriod } from "./client";

/**
 * Which periods to ask IBKR for, so every report fits the statement import's rules: periods of one account never
 * overlap partially and never leave a gap, and a period is replaced only by a report covering all of it.
 *
 * - No statement yet: from the account's opening (or `fallbackDays` back) to yesterday, in chunks of at most
 *   `MAX_WINDOW_DAYS` (IBKR's limit for one Flex request), oldest first, because positions need their history.
 * - Otherwise the latest period is re-requested from its own start to yesterday (it is replaced whole, which also
 *   picks up IBKR's corrections inside it); once that would exceed the limit, a new period starts the day after it.
 */

export const MAX_WINDOW_DAYS = 365;
/** Initial history when the report has no opening date. */
export const DEFAULT_HISTORY_DAYS = 365;
/** Bound on the chunks of one initial import (about ten years). */
export const MAX_INITIAL_WINDOWS = 10;

const DAY = 86_400_000;
export function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
/**
 * Last day IBKR has a closed statement for: yesterday, or the Friday before when yesterday is a weekend day (IBKR
 * answers 1003 «statement not available» for a period ending on a Saturday or Sunday; nothing is booked on those days).
 */
export function lastClosedDay(todayKey: string): string {
  const yesterday = shiftDay(todayKey, -1);
  const weekday = new Date(`${yesterday}T00:00:00Z`).getUTCDay();
  return weekday === 6 ? shiftDay(yesterday, -1) : weekday === 0 ? shiftDay(yesterday, -2) : yesterday;
}

/** Inclusive length of a period in days. */
export function spanDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
}

function chunks(from: string, to: string): IbkrFlexPeriod[] {
  const out: IbkrFlexPeriod[] = [];
  for (let start = from; start <= to; start = shiftDay(start, MAX_WINDOW_DAYS)) {
    const end = shiftDay(start, MAX_WINDOW_DAYS - 1);
    out.push({ from: start, to: end < to ? end : to });
  }
  return out;
}

export interface WindowInput {
  /** Periods already imported for this account (from CSV statements or earlier syncs). */
  existing: { from: string; to: string }[];
  /** Last day IBKR has closed data for: yesterday. */
  through: string;
  dateOpened: string | null;
}

/** The periods to request, oldest first; empty when everything up to `through` is already imported. */
export function planWindows({ existing, through, dateOpened }: WindowInput): IbkrFlexPeriod[] {
  const latest = [...existing].sort((a, b) => b.to.localeCompare(a.to))[0];
  if (!latest) {
    const start = dateOpened && dateOpened <= through ? dateOpened : shiftDay(through, -(DEFAULT_HISTORY_DAYS - 1));
    const all = chunks(start, through);
    // Too long a history: keep the most recent chunks; the positions check will ask for the earlier statements.
    return all.slice(-MAX_INITIAL_WINDOWS);
  }
  if (latest.to >= through) return [];
  if (spanDays(latest.from, through) <= MAX_WINDOW_DAYS) return [{ from: latest.from, to: through }];
  return chunks(shiftDay(latest.to, 1), through);
}
