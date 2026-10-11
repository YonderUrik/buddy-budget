/**
 * Riduce lo storico degli snapshot per le viste a grafico: oltre `COMPACT_KEEP_DAYS` giorni dalla data di riferimento
 * `buildNetWorthSeries` usa solo l'ultimo valore di ogni mese, quindi per ogni classe basta tenere l'ultima riga di
 * ciascun mese (più la prima in assoluto, che fissa l'inizio dello storico). Il resto resta giornaliero.
 */

/** Giorni recenti tenuti per intero: un anno di grafico più il margine per il valore di partenza del periodo. */
export const COMPACT_KEEP_DAYS = 400;

export interface CompactableRow {
  date: string;
  assetClass: string;
}

/** Restituisce solo le righe necessarie ai grafici: le recenti per intero, delle più vecchie l'ultima di ogni mese per classe. */
export function compactSnapshotRows<T extends CompactableRow>(rows: readonly T[], referenceDate: string): T[] {
  const cutoff = new Date(`${referenceDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - COMPACT_KEEP_DAYS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  const keep = new Set<T>();
  const lastOfMonth = new Map<string, T>();
  const firstOfClass = new Map<string, T>();
  for (const row of rows) {
    if (row.date >= cutoffKey) {
      keep.add(row);
      continue;
    }
    const monthKey = `${row.assetClass}|${row.date.slice(0, 7)}`;
    const current = lastOfMonth.get(monthKey);
    if (!current || row.date >= current.date) lastOfMonth.set(monthKey, row);
    const first = firstOfClass.get(row.assetClass);
    if (!first || row.date < first.date) firstOfClass.set(row.assetClass, row);
  }
  for (const row of lastOfMonth.values()) keep.add(row);
  for (const row of firstOfClass.values()) keep.add(row);
  return rows.filter((row) => keep.has(row));
}
