import { parseCsvRecords } from "@/lib/investments/import/csv";
import type { Outcome, PersonalParser, PersonalTable } from "./contract";

/** Reject decimal scaling mistakes for unambiguous, directly mapped cash amounts before persistence. */
export function validateSourceAmounts(parser: PersonalParser, table: PersonalTable, outcomes: Outcome[]) {
  if (parser.kind !== "javascript" || !parser.metadata || !table.rawCsv || parser.metadata.delimiter === "unknown") return;
  const columns = parser.metadata.columns.filter(c => c.mapsTo.includes("amount"));
  // Composite amounts and multi-section layouts need their own reconciliation rules.
  if (columns.length !== 1 || columns[0].section !== null || columns[0].mapsTo.length !== 1) return;
  const column = columns[0];
  if (!column.name || !/^(amount|importo|net amount|importo netto)$/i.test(column.name)) return;
  const records = parseCsvRecords(table.rawCsv, parser.metadata.delimiter);
  const header = records.find(r => r.cells[column.index]?.trim() === column.name);
  if (!header) return;
  const byLine = new Map(records.map(r => [r.line - 1, r]));
  for (const outcome of outcomes) {
    if (outcome.kind !== "cash" || outcome.row < header.line) continue;
    const value = byLine.get(outcome.row)?.cells[column.index]?.trim();
    // A single separator followed by one/two digits is decimal; never infer ambiguous thousands.
    if (!value || !/^[+-]?\d+(?:[.,]\d{1,2})?$/.test(value)) continue;
    const expected = Number(value.replace(",", "."));
    if (Math.abs(expected - outcome.amount) > 0.000001) throw new Error("Importo diverso dalla colonna originale");
  }
}
