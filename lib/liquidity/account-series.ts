/** Balance trend of a single account, rebuilt backwards from the current balance and the transactions. Pure logic. */

import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { parseDateOnly, startOfDay } from "@/lib/calc/expenses";
import type { Account } from "@/lib/db/schema/accounts";
import type { Transaction } from "@/lib/db/schema/transactions";

/** Account type of a broker's cash account created by a statement import (`execute-statement.ts`). */
export const BROKER_CASH_ACCOUNT_TYPE = "Liquidità broker";

export interface BalancePoint {
  date: string;
  value: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The account fields the series needs; `followsTransactions` comes from `GET /api/accounts`. */
export type BalanceSeriesAccount = Pick<Account, "id" | "balance" | "source"> & { followsTransactions?: boolean };

/** True when the account's balance moves with its transactions: a linked bank or a file import. */
export function accountFollowsTransactions(account: BalanceSeriesAccount): boolean {
  return account.followsTransactions ?? account.source === "auto";
}

/**
 * End-of-day balance from `from` to today. For an account whose balance follows its transactions (linked bank, file
 * import) it is the current balance minus later transactions (full amount: a «Dividi» share does not change the
 * money on the account). A manual account's transactions move its balance only since 2026-10-27, so the balance minus
 * later transactions is not its past: a flat line at today's balance.
 */
export function buildAccountBalanceSeries(account: BalanceSeriesAccount, transactions: Transaction[], from: Date, today: Date): BalancePoint[] {
  const todayStart = startOfDay(today);
  const fromStart = startOfDay(from);
  const current = Number(account.balance);
  const mine = accountFollowsTransactions(account) ? transactions.filter((t) => t.accountId === account.id) : [];
  const byDate = new Map<string, number>();
  let after = 0;
  for (const t of mine) {
    if (parseDateOnly(t.date).getTime() > todayStart.getTime()) after += Number(t.amount);
    else byDate.set(t.date, (byDate.get(t.date) ?? 0) + Number(t.amount));
  }
  const points: BalancePoint[] = [];
  let running = after;
  for (let cursor = todayStart; cursor.getTime() >= fromStart.getTime(); cursor = addDays(cursor, -1)) {
    const key = toDateKey(cursor);
    points.push({ date: key, value: round2(current - running) });
    running += byDate.get(key) ?? 0;
  }
  return points.reverse();
}

/**
 * End-of-day balance from `from` to today of a broker cash account rebuilt from its statements: each day takes the
 * last rebuilt balance on or before it (zero before the first statement), today the account's current balance.
 */
export function buildStatementBalanceSeries(history: readonly BalancePoint[], current: number, from: Date, today: Date): BalancePoint[] {
  const todayStart = startOfDay(today);
  const todayKey = toDateKey(todayStart);
  const sorted = [...history].filter((p) => p.date < todayKey).sort((a, b) => (a.date < b.date ? -1 : 1));
  const points: BalancePoint[] = [];
  let index = 0;
  let last = 0;
  for (let cursor = startOfDay(from); cursor.getTime() <= todayStart.getTime(); cursor = addDays(cursor, 1)) {
    const key = toDateKey(cursor);
    while (index < sorted.length && sorted[index].date <= key) last = sorted[index++].value;
    points.push({ date: key, value: key === todayKey ? round2(current) : round2(last) });
  }
  return points;
}
