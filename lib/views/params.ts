/** Query parameters shared by the view endpoints. */
import { parseDateOnly, startOfDay, type ExpensePeriod } from "@/lib/calc/expenses";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const NET_WORTH_PERIODS: readonly NetWorthPeriod[] = ["1mese", "3mesi", "1anno", "max"];

/**
 * `today=YYYY-MM-DD` of the client (its local day, as the web uses the browser's), as a local-midnight Date;
 * `undefined` when absent, `null` when malformed. Without it the server's day is used.
 */
export function parseTodayParam(request: Request): Date | null | undefined {
  return parseDateParam(request, "today");
}

/** A `YYYY-MM-DD` query parameter as a local-midnight Date; `undefined` when absent, `null` when malformed. */
export function parseDateParam(request: Request, name: string): Date | null | undefined {
  const value = new URL(request.url).searchParams.get(name);
  if (value === null) return undefined;
  if (!DATE_ONLY.test(value)) return null;
  const date = parseDateOnly(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

/** Net-worth chart period (`1mese|3mesi|1anno|max`), `fallback` when absent, null when unknown. */
export function parseNetWorthPeriod(value: string | null, fallback: NetWorthPeriod): NetWorthPeriod | null {
  if (value === null) return fallback;
  return (NET_WORTH_PERIODS as readonly string[]).includes(value) ? (value as NetWorthPeriod) : null;
}

/** Extras that `GET /api/accounts?include=` can add to each account. */
export const ACCOUNT_INCLUDES = ["trend", "health"] as const;
export type AccountInclude = (typeof ACCOUNT_INCLUDES)[number];

/** The requested extras (empty set when absent), or null when the list names an unknown one. */
export function parseAccountIncludes(value: string | null): Set<AccountInclude> | null {
  if (!value) return new Set();
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.some((part) => !(ACCOUNT_INCLUDES as readonly string[]).includes(part))) return null;
  return new Set(parts as AccountInclude[]);
}

const EXPENSE_PERIODS: readonly ExpensePeriod[] = ["settimana", "mese", "3mesi", "anno"];

/** Liquidità period (`settimana|mese|3mesi|anno`), `fallback` when absent, null when unknown. */
export function parseExpensePeriod(value: string | null, fallback: ExpensePeriod): ExpensePeriod | null {
  if (value === null) return fallback;
  return (EXPENSE_PERIODS as readonly string[]).includes(value) ? (value as ExpensePeriod) : null;
}
