import { syncAccountLink, type SyncProgress, type SyncResult, type SyncableLink } from "@/lib/gocardless/sync";
import type { RateLimitStore } from "@/lib/gocardless/rate-limit";
import type { SyncJobStore } from "./store";
import { SYNC_JOB_HEARTBEAT_MS, type SyncJobAccountPatch } from "./types";

export interface RunSyncJobDeps {
  store: SyncJobStore;
  rateLimitStore: RateLimitStore;
}

/** Traduce l'avanzamento di `syncAccountLink` in una patch del conto nel job. */
export function progressToPatch(progress: SyncProgress): SyncJobAccountPatch {
  return { ...progress };
}

/** Traduce l'esito finale di un sync nella fase conclusiva del conto. */
export function resultToPatch(result: SyncResult): SyncJobAccountPatch {
  switch (result.status) {
    case "synced":
      return {
        phase: "done",
        inserted: result.newTransactionsCount,
        categorized: result.categorizedCount,
        uncategorized: result.uncategorizedCount,
      };
    case "gocardless-limited":
      return { phase: "limited" };
    case "expired":
      return { phase: "expired" };
  }
}

async function runAccount(job: { id: string; userId: string }, link: SyncableLink, deps: RunSyncJobDeps) {
  const update = async (patch: SyncJobAccountPatch) => {
    try {
      await deps.store.updateAccount(job.userId, job.id, link.accountId, patch);
    } catch (error) {
      console.error(`Aggiornamento del job ${job.id} fallito per il conto ${link.accountId}`, error);
    }
  };

  // Le chiamate GoCardless (saldo/movimenti) possono restare in attesa a lungo senza che
  // syncAccountLink emetta un progress: senza questo keep-alive l'heartbeat scade e il job
  // sembra interrotto pur essendo ancora in corso.
  const heartbeat = setInterval(() => {
    update({});
  }, SYNC_JOB_HEARTBEAT_MS);

  try {
    const result = await syncAccountLink(link, deps.rateLimitStore, (progress) => update(progressToPatch(progress)));
    await update(resultToPatch(result));
  } catch (error) {
    console.error(`Sync fallito per il conto ${link.accountId}`, error);
    await update({ phase: "error" });
  } finally {
    clearInterval(heartbeat);
    try {
      await deps.store.releaseAccountLock(link.accountId);
    } catch (error) {
      console.error(`Rilascio del lock fallito per il conto ${link.accountId}`, error);
    }
  }
}

/**
 * Esegue un job di sync: tutti i conti in parallelo, ognuno isolato dagli errori degli altri.
 * Pensato per girare in `after()`: non lancia mai e rilascia sempre il lock dei conti ricevuti.
 */
export async function runSyncJob(
  job: { id: string; userId: string },
  links: SyncableLink[],
  deps: RunSyncJobDeps
): Promise<void> {
  await Promise.allSettled(links.map((link) => runAccount(job, link, deps)));
}
