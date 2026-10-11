/** Andamento del saldo di un singolo conto, ricostruito all'indietro dal saldo attuale e dai movimenti. Logica pura. */

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

/**
 * Saldo a fine giornata dal giorno `from` a oggi. Per un conto collegato vale: saldo attuale meno i movimenti
 * successivi (si usa l'importo pieno, la quota "Dividi" non cambia i soldi sul conto). Un conto manuale non registra
 * i movimenti nel saldo: resta una linea piatta sul saldo attuale.
 */
export function buildAccountBalanceSeries(account: Account, transactions: Transaction[], from: Date, today: Date): BalancePoint[] {
  const todayStart = startOfDay(today);
  const fromStart = startOfDay(from);
  const current = Number(account.balance);
  const mine = account.source === "auto" ? transactions.filter((t) => t.accountId === account.id) : [];
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
