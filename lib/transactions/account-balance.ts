import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";

type Writer = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Moves the balance of one of the user's accounts by `delta` (signed, in the account's currency), atomically in SQL.
 * Called when a transaction typed by hand is added, edited or deleted, so manual and file-import accounts follow
 * their transactions like a bank does; linked accounts never go through here (their balance comes from the bank).
 * A zero delta writes nothing.
 */
export async function moveAccountBalance(writer: Writer, userId: string, accountId: string, delta: number): Promise<void> {
  const cents = Math.round(delta * 100);
  if (cents === 0) return;
  await writer
    .update(accounts)
    .set({ balance: sql`${accounts.balance} + ${(cents / 100).toFixed(2)}`, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId), eq(accounts.source, "manuale")));
}
