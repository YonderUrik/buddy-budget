export const MAX_SYNCS_PER_DAY = 4;
export const MIN_SYNC_GAP_MS = 4 * 60 * 60 * 1000;
export const SYNC_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SyncEligibility {
  eligible: boolean;
  syncsUsedToday: number;
  syncsRemainingToday: number;
  nextEligibleAt: Date | null;
}

/**
 * Eleggibilità di un sync (automatico o manuale) dato lo storico dei timestamp
 * recenti: tetto di MAX_SYNCS_PER_DAY in una finestra scorrevole di 24h, più un
 * gap minimo di 4h dall'ultimo sync. `nextEligibleAt` è il momento in cui
 * ENTRAMBE le condizioni tornano vere (il massimo tra le due scadenze).
 */
export function computeSyncEligibility(recentSyncTimestamps: Date[], now: Date): SyncEligibility {
  const windowStart = now.getTime() - SYNC_WINDOW_MS;
  const recentInWindow = recentSyncTimestamps
    .filter((t) => t.getTime() > windowStart)
    .sort((a, b) => a.getTime() - b.getTime());

  const syncsUsedToday = recentInWindow.length;
  const syncsRemainingToday = Math.max(0, MAX_SYNCS_PER_DAY - syncsUsedToday);
  const capOk = syncsUsedToday < MAX_SYNCS_PER_DAY;

  const lastSync = recentSyncTimestamps.reduce<Date | null>(
    (latest, t) => (!latest || t.getTime() > latest.getTime() ? t : latest),
    null
  );
  const minGapOk = !lastSync || now.getTime() - lastSync.getTime() >= MIN_SYNC_GAP_MS;

  const eligible = minGapOk && capOk;

  const minGapDeadline = lastSync ? lastSync.getTime() + MIN_SYNC_GAP_MS : -Infinity;
  const capDeadline = capOk ? -Infinity : recentInWindow[0].getTime() + SYNC_WINDOW_MS;
  const nextEligibleAt = eligible ? null : new Date(Math.max(minGapDeadline, capDeadline));

  return { eligible, syncsUsedToday, syncsRemainingToday, nextEligibleAt };
}
