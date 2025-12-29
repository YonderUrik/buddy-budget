/**
 * Date utility functions for common date operations
 */

export type QuickDateRange =
  | "1M"
  | "3M"
  | "6M"
  | "1Y"
  | "2Y"
  | "5Y"
  | "YTD"
  | "MAX";

/**
 * Calculate date range based on quick range selection
 *
 * @param range - Quick range selector (1M, 3M, 6M, 1Y, 2Y, 5Y, YTD, MAX)
 * @returns Object with start and end dates
 *
 * @example
 * getDateRangeFromQuickRange("3M") // { start: 3 months ago, end: now }
 * getDateRangeFromQuickRange("YTD") // { start: Jan 1 this year, end: now }
 */
export function getDateRangeFromQuickRange(range: QuickDateRange): {
  start: Date;
  end: Date;
} {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case "1M":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3M":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6M":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1Y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "2Y":
      start.setFullYear(start.getFullYear() - 2);
      break;
    case "5Y":
      start.setFullYear(start.getFullYear() - 5);
      break;
    case "YTD":
      start.setMonth(0);
      start.setDate(1);
      break;
    case "MAX":
      start.setFullYear(start.getFullYear() - 20);
      break;
  }

  return { start, end };
}

/**
 * Add days to a date
 *
 * @param date - The starting date
 * @param days - Number of days to add (can be negative)
 * @returns New date with days added
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
}

/**
 * Add months to a date
 *
 * @param date - The starting date
 * @param months - Number of months to add (can be negative)
 * @returns New date with months added
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);

  result.setMonth(result.getMonth() + months);

  return result;
}

/**
 * Add years to a date
 *
 * @param date - The starting date
 * @param years - Number of years to add (can be negative)
 * @returns New date with years added
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date);

  result.setFullYear(result.getFullYear() + years);

  return result;
}

/**
 * Get the start of day (00:00:00.000)
 *
 * @param date - The date
 * @returns New date at start of day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
}

/**
 * Get the end of day (23:59:59.999)
 *
 * @param date - The date
 * @returns New date at end of day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);

  result.setHours(23, 59, 59, 999);

  return result;
}

/**
 * Get the start of month (first day at 00:00:00.000)
 *
 * @param date - The date
 * @returns New date at start of month
 */
export function startOfMonth(date: Date): Date {
  const result = new Date(date);

  result.setDate(1);
  result.setHours(0, 0, 0, 0);

  return result;
}

/**
 * Get the start of year (Jan 1 at 00:00:00.000)
 *
 * @param date - The date
 * @returns New date at start of year
 */
export function startOfYear(date: Date): Date {
  const result = new Date(date);

  result.setMonth(0);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);

  return result;
}

/**
 * Calculate the difference in days between two dates
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days between dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;

  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Check if a date is today
 *
 * @param date - The date to check
 * @returns True if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is in the past
 *
 * @param date - The date to check
 * @returns True if date is before now
 */
export function isPast(date: Date): boolean {
  return date.getTime() < new Date().getTime();
}

/**
 * Check if a date is in the future
 *
 * @param date - The date to check
 * @returns True if date is after now
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > new Date().getTime();
}
