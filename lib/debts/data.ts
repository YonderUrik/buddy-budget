import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { debtEvents, debts, type Debt, type DebtEvent } from "@/lib/db/schema/debts";

/** Debiti ed eventi dell'utente, nell'ordine in cui sono stati inseriti. */
export async function loadUserDebts(userId: string): Promise<{ debts: Debt[]; events: DebtEvent[] }> {
  const [debtRows, eventRows] = await Promise.all([
    db.select().from(debts).where(eq(debts.userId, userId)).orderBy(asc(debts.createdAt)),
    db.select().from(debtEvents).where(eq(debtEvents.userId, userId)).orderBy(asc(debtEvents.date)),
  ]);
  return { debts: debtRows, events: eventRows };
}

/** Un debito dell'utente, o null se non esiste o è di un altro (mai distinguere i due casi verso il client). */
export async function findOwnDebt(userId: string, debtId: string): Promise<Debt | null> {
  const [row] = await db.select().from(debts).where(eq(debts.id, debtId));
  return row && row.userId === userId ? row : null;
}
