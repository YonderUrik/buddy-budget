import { z } from "zod";

export const PARSED_FIELDS = ["date", "currency", "description", "amount", "transfer", "type", "name", "isin", "symbol", "instrumentType", "quantity", "price", "grossAmount", "fees", "taxes", "note", "sourceCurrency", "costCurrency", "brokerFxToEur", "bankCategory"] as const;
const label = z.string().trim().min(1).max(200);
/** Describes a file layout, never example values, account identifiers or transaction contents. */
export const formatMetadataSchema = z.object({
  version: z.literal(1),
  institution: z.object({ name: label.nullable(), evidence: z.enum(["document", "user", "recognized_format", "unknown"]) }),
  delimiter: z.enum([",", ";", "\t", "|", "unknown"]),
  columns: z.array(z.object({ section: label.nullable(), index: z.number().int().min(0).max(1000), name: label.nullable(), mapsTo: z.array(z.enum(PARSED_FIELDS)).max(PARSED_FIELDS.length) })).max(1000),
}).superRefine((metadata, ctx) => {
  if ((metadata.institution.name === null) !== (metadata.institution.evidence === "unknown")) ctx.addIssue({ code: "custom", message: "Institution and evidence must agree" });
});
export type FormatMetadata = z.infer<typeof formatMetadataSchema>;
export type ParsedField = typeof PARSED_FIELDS[number];

/** Only field names present on validated financial rows; no values or parser-internal keys. */
export function observedFields(rows: readonly object[]): ParsedField[] {
  const keys = new Set(rows.flatMap(row => Object.entries(row).filter(([, value]) => value !== null && value !== undefined).map(([key]) => key)));
  return PARSED_FIELDS.filter(field => keys.has(field));
}

/** Stable layout identity: column order matters, mapping-array order and institution capitalization do not. */
export function metadataIdentity(metadata: FormatMetadata, fields: readonly ParsedField[]): string {
  return JSON.stringify({ ...metadata, institution: { ...metadata.institution, name: metadata.institution.name?.toLowerCase() ?? null }, columns: [...metadata.columns].sort((a, b) => (a.section ?? "").localeCompare(b.section ?? "") || a.index - b.index).map(c => ({ ...c, mapsTo: [...new Set(c.mapsTo)].sort() })), parsedFields: [...new Set(fields)].sort() });
}
