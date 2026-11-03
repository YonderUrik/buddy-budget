import { findOversoldTransaction } from "@/lib/calc/investments";
import { operationFingerprint, type ExistingOperation } from "./plan";

/** An operation the user deleted from a broker source, in the fields that recognise it again in a later import. */
export type ExcludedOperation = ExistingOperation & { id: string; date: string };

/** Signed quantity an operation adds to a position, as the statement reconciliation counts it. */
export function quantityDelta(op: Pick<ExistingOperation, "type" | "quantity">): number {
  const q = Number(op.quantity);
  if (op.type === "acquisto" || op.type === "rettifica") return q;
  if (op.type === "vendita" || op.type === "rimborso") return -q;
  return 0;
}

/** Adds the signed quantity of each excluded operation to `totals`, per instrument. */
export function addExcludedQuantities(totals: Map<string, number>, exclusions: ExcludedOperation[]): Map<string, number> {
  for (const e of exclusions) totals.set(e.instrumentId, (totals.get(e.instrumentId) ?? 0) + quantityDelta(e));
  return totals;
}

/**
 * Pairs incoming operations with the user's deletions of the same source (counted as a multiset, like duplicates), so
 * a deleted operation is not imported again. `others` are the operations already kept around them (earlier history):
 * if skipping would make a sale exceed the shares held, the deletion of that instrument gives way to the broker's
 * history and its exclusions are reported as `stale`, so a later import never breaks on a deletion.
 */
export function applyExclusions<T extends ExistingOperation>(operations: T[], exclusions: ExcludedOperation[], others: ExistingOperation[] = []) {
  const pool = new Map<string, ExcludedOperation[]>();
  for (const e of exclusions) {
    const key = operationFingerprint(e);
    pool.set(key, [...(pool.get(key) ?? []), e]);
  }
  const skipped = new Map<number, ExcludedOperation>();
  operations.forEach((op, index) => {
    const match = pool.get(operationFingerprint(op))?.shift();
    if (match) skipped.set(index, match);
  });

  const asInput = (op: ExistingOperation, id: string) => ({ ...op, id, quantity: String(op.quantity), price: String(op.price), fxRate: "1", fees: "0", taxes: "0", grossAmount: op.grossAmount === null ? null : String(op.grossAmount) });
  const kept = () => operations.filter((_, index) => !skipped.has(index));
  const oversoldInstruments = new Set<string>();
  for (;;) {
    const oversold = findOversoldTransaction([...others.map((o, i) => asInput(o, `other-${i}`)), ...kept().map((o, i) => asInput(o, `kept-${i}`))]);
    if (!oversold || oversoldInstruments.has(oversold.instrumentId)) break;
    oversoldInstruments.add(oversold.instrumentId);
    for (const [index, e] of skipped) if (e.instrumentId === oversold.instrumentId) skipped.delete(index);
  }

  const matched = [...skipped.values()];
  const matchedIds = new Set(matched.map((e) => e.id));
  return {
    kept: kept(),
    skippedIndexes: new Set(skipped.keys()),
    /** Exclusions still in force for the operations of this import. */
    matched,
    /** Exclusions with no operation left to hide (the broker corrected it) or given way to avoid an oversell. */
    stale: exclusions.filter((e) => !matchedIds.has(e.id)),
  };
}
