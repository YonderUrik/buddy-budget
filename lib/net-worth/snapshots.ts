import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { deriveLiquidityHistory, toDateKey } from "@/lib/calc/net-worth";

/**
 * True se l'utente ha già almeno una riga di liquidità, reale o derivata. Le righe "investimenti" non contano:
 * hanno una ricostruzione propria, e non devono impedire quella della liquidità.
 */
export async function hasAnySnapshot(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: netWorthSnapshots.id })
    .from(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "liquidita")))
    .limit(1);
  return rows.length > 0;
}

/**
 * Ricostruzione una tantum dello storico di liquidità dai movimenti dei conti Auto: no-op se l'utente ha già snapshot.
 * Scrive con onConflictDoNothing, quindi esecuzioni concorrenti non duplicano né sovrascrivono. Ritorna le righe scritte.
 */
export async function backfillDerivedHistory(userId: string, today: Date = new Date()): Promise<number> {
  if (await hasAnySnapshot(userId)) return 0;

  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const autoAccountIds = userAccounts.filter((a) => a.source === "auto").map((a) => a.id);
  if (autoAccountIds.length === 0) return 0;

  const autoTransactions = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.accountId, autoAccountIds)));

  const points = deriveLiquidityHistory(userAccounts, autoTransactions, today);
  if (points.length === 0) return 0;

  const inserted = await db
    .insert(netWorthSnapshots)
    .values(
      points.map((p) => ({
        userId,
        date: p.date,
        assetClass: "liquidita" as const,
        amount: p.amount.toFixed(2),
        source: "derivato" as const,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: netWorthSnapshots.id });
  return inserted.length;
}

/** Scrive o aggiorna lo snapshot reale del giorno (liquidità = somma dei saldi correnti); sovrascrive sempre una riga derivata. */
export async function writeDailySnapshot(userId: string, today: Date = new Date()): Promise<void> {
  const userAccounts = await db.select({ balance: accounts.balance }).from(accounts).where(eq(accounts.userId, userId));
  const amount = userAccounts.reduce((sum, a) => sum + Number(a.balance), 0).toFixed(2);

  await db
    .insert(netWorthSnapshots)
    .values({ userId, date: toDateKey(today), assetClass: "liquidita", amount, source: "snapshot" })
    .onConflictDoUpdate({
      target: [netWorthSnapshots.userId, netWorthSnapshots.date, netWorthSnapshots.assetClass],
      set: { amount, source: "snapshot", updatedAt: new Date() },
    });
}
