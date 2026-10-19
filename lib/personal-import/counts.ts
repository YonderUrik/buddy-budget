/**
 * How many movements of an imported file were new and how many were already there. Pure, shared by the server (list,
 * email, logs) and the screens; ledgers written before these counts existed have neither, and say nothing about it.
 */
export interface ImportCounts {
  /** Movements (cash rows and investment operations) in the file, skipped unrecognised rows excluded. */
  rows: number;
  /** Of those, the ones already imported before (from this file's source or another of the user's). */
  alreadyPresent: number;
}

/** The counts of an import ledger, or nothing for a ledger written before they were recorded. */
export function importCounts(ledger: { rows?: number; alreadyPresent?: number } | null | undefined): Partial<ImportCounts> {
  return ledger && typeof ledger.rows === "number" && typeof ledger.alreadyPresent === "number" ? { rows: ledger.rows, alreadyPresent: ledger.alreadyPresent } : {};
}

/** `nothing_new`: every movement was already there; `partial`: some were; `all_new`: none; `unknown`: an older ledger. */
export type ImportOverlap = "nothing_new" | "partial" | "all_new" | "unknown";

export function importOverlap(counts: Partial<ImportCounts> | null | undefined): ImportOverlap {
  if (!counts || counts.rows === undefined || counts.alreadyPresent === undefined) return "unknown";
  if (counts.alreadyPresent === 0) return "all_new";
  return counts.alreadyPresent >= counts.rows ? "nothing_new" : "partial";
}
