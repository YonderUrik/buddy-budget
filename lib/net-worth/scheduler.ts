import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { backfillDerivedHistory, writeDailySnapshot } from "./snapshots";
import { hashUserId, logger } from "@/lib/observability";

/** Id degli utenti con almeno un conto. */
export async function findUsersWithAccounts(): Promise<string[]> {
  const rows = await db.selectDistinct({ userId: accounts.userId }).from(accounts);
  return rows.map((r) => r.userId);
}

/** Snapshot di un utente: ricostruzione una tantum (se non ha ancora righe) e poi snapshot reale del giorno. */
export async function snapshotUser(userId: string, today: Date = new Date()): Promise<void> {
  await backfillDerivedHistory(userId, today);
  await writeDailySnapshot(userId, today);
}

/** Esegue lo snapshot per tutti gli utenti con conti; l'errore su un utente viene loggato e non blocca gli altri. */
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

