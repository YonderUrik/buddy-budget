import { isPlausiblePensionDate } from "@/lib/validation/pension";
import type { ImportedSnapshot } from "./mapping";

/** Fotografia già salvata, nei campi che servono al confronto. */
export interface ExistingSnapshot {
  date: string;
  netContributions: number;
  value: number;
}

/**
 * Esito di una riga: `new` aggiunge la fotografia, `update` sostituisce i valori di quella stessa data, `unchanged`
 * è già presente identica (o ripetuta nel file) e si salta, `error` blocca l'import.
 */
export interface PlannedSnapshotRow {
  line: number;
  date: string;
  status: "new" | "update" | "unchanged" | "error";
  message?: string;
  /** Valori attuali, per mostrare cosa cambia in un aggiornamento. */
  previous?: { netContributions: number; value: number };
}

export interface SnapshotImportPlan {
  rows: PlannedSnapshotRow[];
  counts: { new: number; update: number; unchanged: number; error: number };
  /** Problema che riguarda tutto l'import (troppe fotografie). */
  error?: string;
}

const cents = (n: number) => Math.round(n * 100);
const same = (a: { netContributions: number; value: number }, b: { netContributions: number; value: number }) =>
  cents(a.netContributions) === cents(b.netContributions) && cents(a.value) === cents(b.value);

/**
 * Decide cosa fare di ogni riga, in modo prevedibile: stessa data di una fotografia salvata → aggiorna (o salta se
 * identica); la stessa data due volte nel file con valori uguali → la seconda si salta, con valori diversi è un
 * errore (non si indovina quale valga). Reimportare lo stesso file non cambia nulla. Stessa logica sul client
 * (anteprima) e sul server (che ricontrolla tutto prima di scrivere).
 */
export function planSnapshotImport(incoming: ImportedSnapshot[], existing: ExistingSnapshot[], todayKey: string, maxSnapshots: number): SnapshotImportPlan {
  const saved = new Map(existing.map((s) => [s.date, s]));
  const seen = new Map<string, ImportedSnapshot>();
  const rows: PlannedSnapshotRow[] = incoming.map((snap): PlannedSnapshotRow => {
    if (!isPlausiblePensionDate(snap.date, todayKey)) return { line: snap.line, date: snap.date, status: "error", message: "Data nel futuro o troppo vecchia" };
    const earlier = seen.get(snap.date);
    if (earlier) {
      return same(earlier, snap)
        ? { line: snap.line, date: snap.date, status: "unchanged", message: `Uguale alla riga ${earlier.line}` }
        : { line: snap.line, date: snap.date, status: "error", message: `Stessa data della riga ${earlier.line} con valori diversi` };
    }
    seen.set(snap.date, snap);
    const current = saved.get(snap.date);
    if (!current) return { line: snap.line, date: snap.date, status: "new" };
    const previous = { netContributions: current.netContributions, value: current.value };
    return { line: snap.line, date: snap.date, status: same(current, snap) ? "unchanged" : "update", previous };
  });
  const counts = { new: 0, update: 0, unchanged: 0, error: 0 };
  for (const row of rows) counts[row.status] += 1;
  const plan: SnapshotImportPlan = { rows, counts };
  if (existing.length + counts.new > maxSnapshots) plan.error = `Il fondo avrebbe più di ${maxSnapshots} fotografie`;
  return plan;
}
