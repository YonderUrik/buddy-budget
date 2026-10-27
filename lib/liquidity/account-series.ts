/** Balance trend of a single account, rebuilt backwards from the current balance and the transactions. Pure logic. */

import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { parseDateOnly, startOfDay } from "@/lib/calc/expenses";
import type { Account } from "@/lib/db/schema/accounts";
import type { Transaction } from "@/lib/db/schema/transactions";

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
