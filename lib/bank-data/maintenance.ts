import "server-only";
import { sendConsentNotices, markExpiredConnections } from "./consent-notices";
import { runBankCleanup, type CleanupReport } from "./cleanup";
import { purgeOldAttempts } from "./capacity-store";
import type { CleanupMode, Logger } from "@/lib/observability";

export type MaintenanceMode = "off" | CleanupMode;

/** Legge `BANK_CLEANUP_MODE` (o il vecchio `GOCARDLESS_CLEANUP_MODE`): assente o sconosciuto = `dry-run` (la scelta sicura), mai `execute` per errore. */
export function parseMaintenanceMode(value: string | undefined): MaintenanceMode {
  return value === "off" || value === "execute" ? value : "dry-run";
}

/** Legge `GOCARDLESS_CLEANUP_APPROVED_REQUISITIONS` (solo GoCardless, l'unico che elenca i consensi): id separati da virgola o spazi, approvati a mano uno per uno. */
export function parseApprovedRequisitions(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(/[\s,]+/).filter(Boolean));
}

export interface MaintenanceResult {
  expiredMarked: number;
  notices: { sent: number; failed: number };
  cleanup: CleanupReport | null;
  /** Elementi falliti (email o eliminazioni): il cron risulta in errore e l'alert se ne accorge. */
  failed: number;
}

/**
 * Manutenzione giornaliera delle connessioni bancarie (tutti i fornitori): segna le scadute, avvisa gli utenti e
 * revoca i consensi non più usati. Con `mode: "off"` fa solo le prime due (gli avvisi non dipendono dalla pulizia).
 */
export async function runBankMaintenance(options: {
  mode: MaintenanceMode;
  deleteUnknown?: boolean;
  approvedRequisitionIds?: ReadonlySet<string>;
  now?: Date;
  log?: Logger;
}): Promise<MaintenanceResult> {
  const now = options.now ?? new Date();
  const expiredMarked = await markExpiredConnections(now);
  const notices = await sendConsentNotices(now);
  await purgeOldAttempts(now);
  const cleanup =
    options.mode === "off"
      ? null
      : await runBankCleanup({
          mode: options.mode,
          deleteUnknown: options.deleteUnknown,
          approvedRequisitionIds: options.approvedRequisitionIds,
          now,
          log: options.log,
        });
  return { expiredMarked, notices, cleanup, failed: notices.failed + (cleanup?.failed ?? 0) };
}
