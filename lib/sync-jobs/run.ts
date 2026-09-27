import type { SyncProgress, SyncResult, SyncableLink } from "@/lib/gocardless/sync";
import { syncAccountLinkObserved } from "@/lib/gocardless/sync-telemetry";
import { logger as appLogger, type Logger, type OpsStore, type SyncTrigger } from "@/lib/observability";
import type { RateLimitStore } from "@/lib/gocardless/rate-limit";
import type { SyncJobStore } from "./store";
import { SYNC_JOB_HEARTBEAT_MS, type SyncJobAccountPatch, type SyncJobKind } from "./types";

export interface RunSyncJobDeps {
  store: SyncJobStore;
  rateLimitStore: RateLimitStore;
  /** Stato operativo per la metrica dei job attivi/bloccati (opzionale: senza, non viene aggiornato). */
  ops?: OpsStore;
  /** Logger della richiesta che ha avviato il job (collega job e richiesta via requestId). */
  log?: Logger;
}

/** Il job di import iniziale nasce dal finalize del collegamento; il sync manuale dal bottone in Conti. */
export function syncTriggerForJob(kind: SyncJobKind | undefined): SyncTrigger {
  return kind === "initial-import" ? "finalize" : "manual";
}

type RunnableJob = { id: string; userId: string; kind?: SyncJobKind };

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

async function runAccount(job: RunnableJob, link: SyncableLink, deps: RunSyncJobDeps, log: Logger) {
  const update = async (patch: SyncJobAccountPatch) => {
    try {
      await deps.store.updateAccount(job.userId, job.id, link.accountId, patch);
    } catch (error) {
      log.warn("sync_job.update.failed", { accountId: link.accountId, error });
    }
  };

  // Le chiamate GoCardless (saldo/movimenti) possono restare in attesa a lungo senza che
  // syncAccountLink emetta un progress: senza questo keep-alive l'heartbeat scade e il job
  // sembra interrotto pur essendo ancora in corso.
  const heartbeat = setInterval(() => {
    update({});
  }, SYNC_JOB_HEARTBEAT_MS);

  try {
    const result = await syncAccountLinkObserved(link, deps.rateLimitStore, {
      trigger: syncTriggerForJob(job.kind),
      log,
      onProgress: (progress) => update(progressToPatch(progress)),
    });
    await update(resultToPatch(result));
  } catch {
    // Già registrato (metrica + log) da syncAccountLinkObserved.
    await update({ phase: "error" });
  } finally {
    clearInterval(heartbeat);
    try {
      await deps.store.releaseAccountLock(link.accountId);
    } catch (error) {
      log.warn("sync_job.lock_release.failed", { accountId: link.accountId, error });
    }
  }
}

/**
 * Esegue un job di sync: tutti i conti in parallelo, ognuno isolato dagli errori degli altri.
 * Pensato per girare in `after()`: non lancia mai e rilascia sempre il lock dei conti ricevuti.
 */
export async function runSyncJob(job: RunnableJob, links: SyncableLink[], deps: RunSyncJobDeps): Promise<void> {
  const log = (deps.log ?? appLogger).child({ jobId: job.id });
  const ops = deps.ops;
  const safely = async (event: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      log.warn(event, { error });
    }
  };
  if (ops) await safely("sync_job.ops.write_failed", () => ops.markJobRunning(job.id, Date.now()));
  const keepAlive = ops
    ? setInterval(() => void safely("sync_job.ops.write_failed", () => ops.markJobRunning(job.id, Date.now())), SYNC_JOB_HEARTBEAT_MS)
    : undefined;
  try {
    await Promise.allSettled(links.map((link) => runAccount(job, link, deps, log)));
  } finally {
    clearInterval(keepAlive);
    if (ops) await safely("sync_job.ops.write_failed", () => ops.markJobDone(job.id));
  }
}
