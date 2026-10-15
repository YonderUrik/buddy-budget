import type { FormatMetadata, ParsedField } from "@/lib/imports";
import type { ActivityStatement } from "./interactive-brokers";
import type { CsvTable } from "./csv";
import type { ImportMapping } from "./mapping";
import { getImportProvider, type ImportProviderId } from "./providers";

/** Source columns come from parser-recognized headers, never the first arbitrary line in a document. */
export function statementFormatMetadata(statement: ActivityStatement): FormatMetadata {
  const columns = new Map<string, FormatMetadata["columns"][number]>();
  for (const record of statement.records) for (const [index, name] of record.headers.entries()) {
    const column = { section: record.section || null, index, name: name.trim() || null, mapsTo: [] };
    columns.set(JSON.stringify([column.section, index, column.name]), column);
  }
  return { version: 1, institution: { name: getImportProvider(statement.preset).name, evidence: "recognized_format" }, delimiter: statement.preset === "interactive-brokers" ? "," : "unknown", columns: [...columns.values()] };
}

/** Preserve the selected column mapping; a generic CSV does not imply a known institution. */
export function mappedFormatMetadata(table: CsvTable, mapping: ImportMapping, provider: ImportProviderId | null): FormatMetadata {
  return {
    version: 1, institution: provider && provider !== "generic" ? { name: getImportProvider(provider).name, evidence: "recognized_format" } : { name: null, evidence: "unknown" }, delimiter: table.delimiter,
    columns: table.headers.map((name, index) => ({ section: null, index, name: name.trim() || null, mapsTo: Object.entries(mapping.columns).filter(([, col]) => col === index).map(([field]) => (field === "total" ? "grossAmount" : field) as ParsedField) })),
  };
}
