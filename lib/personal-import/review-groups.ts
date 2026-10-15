/** Raggruppa le righe non riconosciute di un'anteprima per motivo, così l'utente vede «cosa non va» in poche voci. */

import type { PreviewRecord } from "./confirm";

export interface ErrorReasonGroup {
  reason: string;
  /** Righe con questo motivo, nell'ordine del file. */
  records: PreviewRecord[];
}

/** Numero di riga nel file originale (l'intestazione è la riga 1). */
export function sourceLine(record: PreviewRecord): number {
  return record.line ?? record.outcome.row + 1;
}

/** Testo originale della riga, per mostrarlo accanto al motivo. */
export function sourceText(record: PreviewRecord): string {
  return record.source.join(" · ").trim();
}

/** Gruppi ordinati dal più numeroso; a parità, dal motivo che compare prima nel file. */
export function groupErrorsByReason(records: PreviewRecord[]): ErrorReasonGroup[] {
  const groups = new Map<string, ErrorReasonGroup>();
  for (const record of records) {
    if (record.outcome.kind !== "error") continue;
    const reason = record.outcome.reason.trim() || "Riga non riconosciuta";
    const group = groups.get(reason) ?? { reason, records: [] };
    group.records.push(record);
    groups.set(reason, group);
  }
  return [...groups.values()].sort((a, b) => b.records.length - a.records.length);
}
