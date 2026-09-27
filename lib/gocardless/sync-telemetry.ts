import {
  logger as appLogger,
  recordGoCardlessSync,
  recordTransactionsImported,
  type Logger,
  type SyncOutcome,
  type SyncTrigger,
} from "@/lib/observability";
import type { RateLimitStore } from "./rate-limit";
import { syncAccountLink, type SyncProgressCallback, type SyncResult, type SyncableLink } from "./sync";

const OUTCOME_BY_STATUS: Record<SyncResult["status"], SyncOutcome> = {
  synced: "synced",
  "gocardless-limited": "limited",
  expired: "expired",
};

export interface SyncTelemetryOptions {
  trigger: SyncTrigger;
  log?: Logger;
  onProgress?: SyncProgressCallback;
}

/**
 * `syncAccountLink` con metriche (`gocardless_sync_total`, durata, transazioni importate) e log
 * `gocardless.sync.completed|limited|expired|failed`. Rilancia gli errori dopo averli registrati:
 * decide il chiamante (job o cron) come isolarli.
 */
export async function syncAccountLinkObserved(
  link: SyncableLink,
  rateLimitStore: RateLimitStore,
  options: SyncTelemetryOptions
): Promise<SyncResult> {
  const log = (options.log ?? appLogger).child({ accountId: link.accountId, trigger: options.trigger });
  const startedAt = Date.now();
  let result: SyncResult;
  try {
    result = await syncAccountLink(link, rateLimitStore, options.onProgress);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    recordGoCardlessSync(options.trigger, "error", durationMs);
    log.error("gocardless.sync.failed", { durationMs, error });
    throw error;
  }
  const durationMs = Date.now() - startedAt;
  const outcome = OUTCOME_BY_STATUS[result.status];
  recordGoCardlessSync(options.trigger, outcome, durationMs);
  if (result.status === "synced") {
    recordTransactionsImported(result.categorizedCount, result.uncategorizedCount);
    log.info("gocardless.sync.completed", {
      durationMs,
      inserted: result.newTransactionsCount,
      categorized: result.categorizedCount,
      uncategorized: result.uncategorizedCount,
    });
  } else {
    log.warn(`gocardless.sync.${outcome}`, { durationMs });
  }
  return result;
}
