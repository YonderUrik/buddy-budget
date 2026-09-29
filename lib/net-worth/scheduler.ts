import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { investmentTransactions } from "@/lib/db/schema/investments";
import { backfillDerivedHistory, writeDailySnapshot } from "./snapshots";
import { refreshDerivedInvestmentHistory, writeInvestmentSnapshot } from "./investments";
import { hashUserId, logger } from "@/lib/observability";

/** Id degli utenti non disattivati con almeno un conto o almeno un'operazione di investimento. */
export async function findUsersWithAccounts(): Promise<string[]> {
  const active = isNull(authUser.deletionScheduledAt);
  const [withAccounts, withInvestments] = await Promise.all([
    db.selectDistinct({ userId: accounts.userId }).from(accounts).innerJoin(authUser, eq(accounts.userId, authUser.id)).where(active),
    db
      .selectDistinct({ userId: investmentTransactions.userId })
      .from(investmentTransactions)
      .innerJoin(authUser, eq(investmentTransactions.userId, authUser.id))
      .where(active),
  ]);
  return [...new Set([...withAccounts, ...withInvestments].map((r) => r.userId))];
}

/**
 * Snapshot di un utente: ricostruzione della liquidità (una tantum, solo se manca) e dello storico investimenti (se
 * operazioni o prezzi sono cambiati), poi snapshot reali del giorno. Gli investimenti usano i prezzi scritti poco prima dal cron market-prices.
 */
export async function snapshotUser(userId: string, today: Date = new Date()): Promise<void> {
  await backfillDerivedHistory(userId, today);
  await writeDailySnapshot(userId, today);
  await refreshDerivedInvestmentHistory(userId, today);
  await writeInvestmentSnapshot(userId, today);
}

/** Esegue lo snapshot per tutti gli utenti con conti o investimenti; l'errore su un utente non blocca gli altri. */
export async function runDailySnapshots(today: Date = new Date()): Promise<void> {
  const userIds = await findUsersWithAccounts();
  for (const userId of userIds) {
    try {
      await snapshotUser(userId, today);
    } catch (error) {
      logger.error("net_worth.snapshot.failed", { user: hashUserId(userId), error });
    }
  }
}
