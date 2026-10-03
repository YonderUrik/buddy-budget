import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseInteractiveBrokersActivity } from "./interactive-brokers";
import { detectImportProvider, providerMismatchMessage } from "./providers";
import { statementToRows, statementWarnings } from "./statement-rows";
import { runImportSchema } from "@/lib/validation/investments-import";

const ibkr = readFileSync(new URL("./__fixtures__/interactive-brokers.csv", import.meta.url), "utf8");
const yahoo = "Symbol,Current Price,Date,Trade Date,Purchase Price,Quantity\nVWCE.MI,100,,20240115,98.5,3\n";

describe("provider di import", () => {
  it("riconosce Interactive Brokers, Yahoo e il resto", () => {
    expect(detectImportProvider(ibkr)).toBe("interactive-brokers");
    expect(detectImportProvider("﻿" + ibkr)).toBe("interactive-brokers");
    expect(detectImportProvider(yahoo)).toBe("yahoo-portfolio");
    expect(detectImportProvider("Data;Tipo\n01/01/2026;Acquisto\n")).toBeNull();
  });

  it("spiega quando il file non corrisponde alla scheda scelta", () => {
    expect(providerMismatchMessage("interactive-brokers", "interactive-brokers")).toBeNull();
    expect(providerMismatchMessage("generic", "yahoo-portfolio")).toBeNull();
    expect(providerMismatchMessage("interactive-brokers", "yahoo-portfolio")).toContain("Yahoo Finance");
    expect(providerMismatchMessage("yahoo-portfolio", null)).toContain("Altro CSV");
  });

  it("converte l'Activity Statement in righe valide per la richiesta di import", () => {
    const statement = parseInteractiveBrokersActivity(ibkr, "2026-10-03");
    const rows = statementToRows(statement);
    expect(rows.filter((r) => r.status === "ok").length).toBe(statement.operations.length);
    const first = rows.find((r) => r.status === "ok");
    expect(first && first.status === "ok" && first.operation.sourceCurrency).toBe("USD");
    expect(statementWarnings(statement).every((i) => i.severity === "warning")).toBe(true);
    const ok = rows.flatMap((r) => (r.status === "ok" ? [{ key: r.identity.key, line: r.line, ...r.operation }] : []));
    const parsed = runImportSchema.safeParse({
      dryRun: true,
      preset: "interactive-brokers",
      instruments: [...new Set(ok.map((o) => o.key))].map((key) => ({
        key,
        instrumentId: "00000000-0000-4000-8000-000000000000",
      })),
      operations: ok,
    });
    expect(parsed.success).toBe(true);
  });
});
