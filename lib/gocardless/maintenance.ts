import "server-only";
import { sendConsentNotices, markExpiredConnections } from "./consent-notices";
import { runGoCardlessCleanup, type CleanupReport } from "./cleanup";
import type { CleanupMode, Logger } from "@/lib/observability";

export type MaintenanceMode = "off" | CleanupMode;

/** Legge `GOCARDLESS_CLEANUP_MODE`: assente o sconosciuto = `dry-run` (la scelta sicura), mai `execute` per errore. */
export function parseMaintenanceMode(value: string | undefined): MaintenanceMode {
  return value === "off" || value === "execute" ? value : "dry-run";
}

export interface MaintenanceResult {
  expiredMarked: number;
  notices: { sent: number; failed: number };
  cleanup: CleanupReport | null;
  /** Elementi falliti (email o eliminazioni): il cron risulta in errore e l'alert se ne accorge. */
  failed: number;
}

/**
 * Manutenzione giornaliera delle connessioni GoCardless: segna le scadute, avvisa gli utenti e ripulisce
 * la lista su GoCardless. Con `mode: "off"` fa solo le prime due (gli avvisi non dipendono dalla pulizia).
 */
export async function runGoCardlessMaintenance(options: {
  mode: MaintenanceMode;
  deleteUnknown?: boolean;
  now?: Date;
  log?: Logger;
}): Promise<MaintenanceResult> {
  const now = options.now ?? new Date();
  const expiredMarked = await markExpiredConnections(now);
  const notices = await sendConsentNotices(now);
  const cleanup =
    options.mode === "off"
      ? null
      : await runGoCardlessCleanup({ mode: options.mode, deleteUnknown: options.deleteUnknown, now, log: options.log });
  return { expiredMarked, notices, cleanup, failed: notices.failed + (cleanup?.failed ?? 0) };
}
