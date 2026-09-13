import cron from "node-cron";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { backfillDerivedHistory, writeDailySnapshot } from "./snapshots";

/** Orario del cron degli snapshot: ogni giorno alle 23:50, orario del server. */
export const NET_WORTH_SNAPSHOT_CRON = "50 23 * * *";

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
      console.error(`Snapshot patrimonio fallito per l'utente ${userId}`, error);
    }
  }
}

let started = false;

/** Avvia il cron giornaliero degli snapshot patrimonio; no-op se già avviato nel processo corrente. */
export function startNetWorthScheduler(): void {
  if (started) return;
  started = true;
  cron.schedule(NET_WORTH_SNAPSHOT_CRON, () => {
    runDailySnapshots().catch((error) => console.error("Snapshot patrimonio fallito", error));
  });
}
