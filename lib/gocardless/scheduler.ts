import cron from "node-cron";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { computeSyncEligibility } from "./sync-eligibility";
import { redisRateLimitStore } from "./redis-rate-limit-store";
import { syncAccountLink, type SyncableLink } from "./sync";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";

export interface DueLink extends SyncableLink {
  syncTimestamps: string[];
}

/** Conti collegati con sync scaduto e connessione ancora valida (non expired/error). */
export async function findDueLinks(): Promise<DueLink[]> {
  return db
    .select({
      linkId: bankAccountLinks.id,
      connectionId: bankAccountLinks.connectionId,
      accountId: bankAccountLinks.accountId,
      externalAccountId: bankAccountLinks.externalAccountId,
      userId: bankConnections.userId,
      syncTimestamps: bankAccountLinks.syncTimestamps,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(and(lte(bankAccountLinks.nextSyncEligibleAt, new Date()), eq(bankConnections.status, "linked")));
}

/**
 * Sincronizza tutti i conti dovuti. Un errore su un conto (rete, 5xx GoCardless)
 * viene loggato e non deve bloccare il sync degli altri conti nello stesso tick.
 * Salta silenziosamente i conti che hanno già esaurito il budget condiviso di
 * sync (4/giorno, gap minimo 4h) per via di sync manuali avvenuti nel frattempo.
 * Salta anche i conti con un sync già in corso (lock per conto).
 */
export async function runDueSyncs(): Promise<void> {
  const due = await findDueLinks();
  const now = new Date();
  for (const link of due) {
    const timestamps = link.syncTimestamps.map((t) => new Date(t));
    if (!computeSyncEligibility(timestamps, now).eligible) continue;
    // Un sync manuale o un import in corso sullo stesso conto ha la precedenza: si salta al prossimo tick.
    // Con Redis irraggiungibile si procede comunque (import idempotente): il cron non deve fermarsi per il lock.
    const locked = await redisSyncJobStore.acquireAccountLock(link.accountId).catch(() => true);
    if (!locked) continue;
    try {
      await syncAccountLink(link, redisRateLimitStore);
    } catch (error) {
      console.error(`Sync fallito per il conto ${link.accountId}`, error);
    } finally {
      await redisSyncJobStore.releaseAccountLock(link.accountId).catch(() => {});
    }
  }
}

let started = false;

/** Avvia lo scheduler cron (ogni 12h); no-op se già avviato nel processo corrente. */
export function startGoCardlessScheduler(): void {
  if (started) return;
  started = true;
  cron.schedule("0 */12 * * *", () => {
    runDueSyncs().catch((error) => console.error("Sync GoCardless fallito", error));
  });
}
