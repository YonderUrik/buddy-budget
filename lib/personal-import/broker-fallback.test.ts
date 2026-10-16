import { describe, expect, it, vi, beforeEach } from "vitest";
import { brokerFallbackSource } from "./broker-fallback";
import { detectImportProvider } from "@/lib/investments/import/providers";
import { parseBrokerStatement } from "@/lib/investments/import/parse-statement";
vi.mock("@/lib/investments/import/providers", () => ({ detectImportProvider: vi.fn(), getImportProvider: () => ({ name: "DEGIRO" }) }));
vi.mock("@/lib/investments/import/parse-statement", () => ({ parseBrokerStatement: vi.fn() }));
beforeEach(() => { vi.mocked(detectImportProvider).mockReturnValue("degiro"); vi.mocked(parseBrokerStatement).mockReset(); });
describe("broker fallback eligibility", () => {
  it("verifies the failure on the server instead of trusting the client", () => {
    vi.mocked(parseBrokerStatement).mockReturnValue({ issues: [{ severity: "error" }] } as never);
    expect(() => brokerFallbackSource("csv")).toThrow("completa la procedura");
  });
  it("allows AI to recover a structural failure", () => {
    vi.mocked(parseBrokerStatement).mockImplementation(() => { throw Error("Riga 3: numero colonne non valido"); });
    expect(brokerFallbackSource("csv")).toMatchObject({provider:"degiro",requiresReconciliation:false});
  });
  it("does not let AI bypass financial failures or unclassified exceptions", () => {
    for (const message of ["Riga 3: controvalore o valuta non coerenti", "unexpected"]) {
      vi.mocked(parseBrokerStatement).mockImplementation(() => { throw Error(message); });
      expect(brokerFallbackSource("csv").requiresReconciliation).toBe(true);
    }
  });
});
