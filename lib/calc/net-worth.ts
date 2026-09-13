import type { Account } from "@/lib/db/schema/accounts";
import type { Transaction } from "@/lib/db/schema/transactions";
import { parseDateOnly, startOfDay } from "./expenses";

/** Profondità massima della ricostruzione dello storico, in mesi. */
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

/** Punto giornaliero di liquidità ricostruita (saldo a fine giornata). */
export interface DerivedLiquidityPoint {
  date: string;
  amount: number;
}

/**
 * Ricostruisce la liquidità a fine giornata dal primo movimento Auto fino a ieri (massimo 24 mesi):
 * saldo attuale di tutti i conti meno i movimenti dei soli conti Auto datati dopo quel giorno.
 * I conti manuali restano costanti perché i loro movimenti non aggiornano il saldo; si usa `amount` pieno.
 */
export function deriveLiquidityHistory(accounts: Account[], transactions: Transaction[], today: Date): DerivedLiquidityPoint[] {
  const autoAccountIds = new Set(accounts.filter((a) => a.source === "auto").map((a) => a.id));
  const autoTransactions = transactions.filter((t) => autoAccountIds.has(t.accountId));
  if (autoTransactions.length === 0) return [];

  const todayStart = startOfDay(today);
  const currentTotal = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const cutoff = new Date(todayStart.getFullYear(), todayStart.getMonth() - MAX_DERIVED_HISTORY_MONTHS, 1);

  const amountByDate = new Map<string, number>();
  let earliest = todayStart;
  let sumAfter = 0;
  for (const t of autoTransactions) {
    const date = parseDateOnly(t.date);
    if (date.getTime() < earliest.getTime()) earliest = date;
    if (date.getTime() >= todayStart.getTime()) {
      sumAfter += Number(t.amount);
    } else {
      amountByDate.set(t.date, (amountByDate.get(t.date) ?? 0) + Number(t.amount));
    }
  }

  const start = earliest.getTime() < cutoff.getTime() ? cutoff : earliest;
  const points: DerivedLiquidityPoint[] = [];
  for (let cursor = addDays(todayStart, -1); cursor.getTime() >= start.getTime(); cursor = addDays(cursor, -1)) {
    const key = toDateKey(cursor);
    points.push({ date: key, amount: round2(currentTotal - sumAfter) });
    sumAfter += amountByDate.get(key) ?? 0;
  }
  return points.reverse();
}
