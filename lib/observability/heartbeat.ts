import { logger as appLogger, type Logger } from "./logger";
import { recordCronRunMetric, type CronName, type CronOutcome } from "./metrics";
import type { OpsStore } from "./ops-store";

/**
 * Registra l'esecuzione di un cron: metrica `cron_runs_total`, log `cron.<nome>.completed|failed`
 * e, solo su successo, l'heartbeat su Redis letto dall'alert "cron non eseguito". Un errore di
 * scrittura dell'heartbeat viene loggato ma non fa fallire il cron.
 */
export async function recordCronRun(
  cron: CronName,
  outcome: CronOutcome,
  durationMs: number,
  deps: { store: OpsStore; log?: Logger; now?: () => number; error?: unknown }
): Promise<void> {
  const log = deps.log ?? appLogger;
  recordCronRunMetric(cron, outcome);
  if (outcome === "error") {
    log.error(`cron.${cron}.failed`, { cron, durationMs, error: deps.error });
    return;
  }
  log.info(`cron.${cron}.completed`, { cron, durationMs });
  try {
    await deps.store.setCronSuccess(cron, Math.floor((deps.now ?? Date.now)() / 1000));
  } catch (error) {
    log.warn("cron.heartbeat.write_failed", { cron, error });
  }
}
