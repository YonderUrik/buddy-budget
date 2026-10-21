import "server-only";
import { count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankConnectionInterest } from "@/lib/db/schema/bank-connections";

/**
 * «Tienimi aggiornato» while new bank connections are closed: one row per person, so the count says how many want the
 * feature and the rows say whom to write to when it opens. Registering twice keeps the first request.
 */
export async function registerBankInterest(userId: string, country: string): Promise<{ created: boolean }> {
  const inserted = await db
    .insert(bankConnectionInterest)
    .values({ userId, country })
    .onConflictDoNothing({ target: bankConnectionInterest.userId })
    .returning({ userId: bankConnectionInterest.userId });
  return { created: inserted.length > 0 };
}

/** «Non avvisarmi più»: withdraws the request (the consent behind the announcement email). */
export async function withdrawBankInterest(userId: string): Promise<{ removed: boolean }> {
  const removed = await db.delete(bankConnectionInterest).where(eq(bankConnectionInterest.userId, userId)).returning({ userId: bankConnectionInterest.userId });
  return { removed: removed.length > 0 };
}

/** Whether this person is waiting for the announcement. */
export async function hasBankInterest(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: bankConnectionInterest.userId })
    .from(bankConnectionInterest)
    .where(eq(bankConnectionInterest.userId, userId))
    .limit(1);
  return Boolean(row);
}

/** People still waiting (not written to yet), for the metric. */
export async function countPendingBankInterest(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(bankConnectionInterest).where(isNull(bankConnectionInterest.notifiedAt));
  return row.n;
}
