import { describe, expect, it } from "vitest";
import { formatMetadataSchema, metadataIdentity, observedFields, type FormatMetadata } from "./metadata";
import { mappedFormatMetadata, statementFormatMetadata } from "@/lib/investments/import/format-metadata";

const metadata: FormatMetadata = { version: 1, institution: { name: "Example Bank", evidence: "document" }, delimiter: ";", columns: [{ section: null, index: 0, name: "Amount", mapsTo: ["amount"] }] };
describe("import format metadata", () => {
  it("stores field names without financial values or internal identifiers", () => {
    expect(observedFields([{ date: "2024-01-01", amount: 123.45, isin: null, row: 4, description: "Private merchant", secret: "secret" }])).toEqual(["date", "description", "amount"]);
  });
  it("validates metadata and rejects invented canonical fields or inconsistent attribution", () => {
    expect(formatMetadataSchema.parse(metadata)).toEqual(metadata);
    expect(() => formatMetadataSchema.parse({ ...metadata, institution: { name: null, evidence: "document" } })).toThrow();
    expect(() => formatMetadataSchema.parse({ ...metadata, columns: [{ ...metadata.columns[0], mapsTo: ["123.45"] }] })).toThrow();
  });
  it("recognizes the same layout while preserving changed mappings", () => {
    expect(metadataIdentity(metadata, ["date", "amount"])).toBe(metadataIdentity({ ...metadata, institution: { ...metadata.institution, name: "EXAMPLE BANK" } }, ["amount", "date"]));
    expect(metadataIdentity(metadata, ["amount"])).not.toBe(metadataIdentity({ ...metadata, columns: [{ ...metadata.columns[0], index: 1 }] }, ["amount"]));
  });
  it("does not label a generic file as an institution and retains the selected mapping", () => {
    const result = mappedFormatMetadata({ delimiter: ",", headers: ["Date", "Value"], rows: [["private", "123"]] }, { columns: { date: 0, total: 1 }, dateOrder: "ymd", decimal: ".", defaultType: "acquisto", typeValues: {}, symbolIsYahoo: false }, null);
    expect(result.institution).toEqual({ name: null, evidence: "unknown" });
    expect(result.columns[1].mapsTo).toEqual(["grossAmount"]);
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("retains different section layouts without collecting any source values", () => {
    const result = statementFormatMetadata({ preset: "interactive-brokers", operations: [], identities: [], issues: [], records: [
      { line: 1, section: "Trades", kind: "Data", headers: ["Date", "Quantity"], values: ["private-date", "9999"] },
      { line: 2, section: "Trades", kind: "Data", headers: ["Date", "Quantity"], values: ["private-date", "9999"] },
      { line: 3, section: "Cash", kind: "Data", headers: ["Date", "Amount"], values: ["private-date", "9999"] },
    ] });
    expect(result.institution.name).toBe("Interactive Brokers");
    expect(result.columns).toHaveLength(4);
    expect(JSON.stringify(result)).not.toMatch(/9999|private-date/);
  });
});
