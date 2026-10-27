import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { transactions } from "@/lib/db/schema/transactions";

/** Calendar years that hold at least one of the user's movements, newest first: lets Movimenti skip empty years. */
export async function transactionYears(userId: string): Promise<number[]> {
  const year = sql<number>`extract(year from ${transactions.date})::int`;
  const rows = await db.selectDistinct({ year }).from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(year));
  return rows.map((row) => Number(row.year));
}
