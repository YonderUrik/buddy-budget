import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, LEGAL_VERSION } from "./legal";

describe("testi legali", () => {
  it("la versione coincide con quella dell'app (lib/legal/version.ts)", () => {
    const appVersionFile = readFileSync(join(__dirname, "..", "..", "lib", "legal", "version.ts"), "utf8");
    const match = appVersionFile.match(/export const LEGAL_VERSION = "([^"]+)"/);
    expect(match?.[1]).toBe(LEGAL_VERSION);
  });

  it("le sezioni da approvare in modo specifico esistono nei Termini", () => {
    const appVersionFile = readFileSync(join(__dirname, "..", "..", "lib", "legal", "version.ts"), "utf8");
    const listed = appVersionFile.match(/SPECIFIC_CLAUSE_SECTIONS = \[([^\]]+)\]/)?.[1].match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ?? [];
    const termini = LEGAL_DOCUMENTS.find((d) => d.slug === "termini")!;
    expect(listed.length).toBeGreaterThan(0);
    for (const title of listed) expect(termini.sections.map((s) => s.title)).toContain(title);
  });

  it("ogni documento ha sezioni con id unici", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const ids = doc.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
