import { parseCsvRecords } from "@/lib/investments/import/csv";
import type { PersonalParser, PersonalTable } from "./contract";

/** At least this many declared names must sit on one line for it to count as that section's header. */
const MIN_HEADER_MATCHES = 2;

/**
 * Header columns the parser's metadata does not declare, as `{ index, name }`. The header of each declared section is
 * the line holding most of its declared column names; every non-empty cell of that line needs a declared index
 * (mapped, or `mapsTo=[]` when ignored). Unknown delimiter or no recognisable header: nothing can be checked.
 */
export function undeclaredColumns(parser: PersonalParser, table: PersonalTable): { index: number; name: string }[] {
  if (parser.kind !== "javascript" || !parser.metadata || !table.rawCsv || parser.metadata.delimiter === "unknown") return [];
  const records = parseCsvRecords(table.rawCsv, parser.metadata.delimiter);
  const sections = new Map<string, typeof parser.metadata.columns>();
  for (const column of parser.metadata.columns) sections.set(column.section ?? "", [...(sections.get(column.section ?? "") ?? []), column]);
  const missing: { index: number; name: string }[] = [];
  for (const columns of sections.values()) {
    const names = new Set(columns.flatMap(c => c.name ? [c.name.trim().toLowerCase()] : []));
    if (names.size < MIN_HEADER_MATCHES) continue;
    let header: string[] | null = null, best = 0;
    for (const record of records) {
      const matches = record.cells.filter(cell => names.has(cell.trim().toLowerCase())).length;
      if (matches > best) { best = matches; header = record.cells; }
    }
    if (!header || best < MIN_HEADER_MATCHES) continue;
    const declared = new Set(columns.map(c => c.index));
    header.forEach((cell, index) => { if (cell.trim() && !declared.has(index)) missing.push({ index, name: cell.trim().slice(0, 80) }); });
  }
  return missing;
}
