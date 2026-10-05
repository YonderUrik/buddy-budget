import { describe, expect, it } from "vitest";
import { logoSourceFor } from "./logo-source";

describe("logoSourceFor", () => {
  it("per un ETF usa l'emittente dal nome, mai l'ISIN", () => {
    expect(logoSourceFor({ type: "etf", name: "Xtrackers MSCI World UCITS ETF", isin: "LU0290358497" })).toEqual({
      kind: "issuer",
      domain: "dws.com",
      key: "issuer:dws.com",
    });
  });

  it("senza un emittente riconosciuto non chiede niente per ETF e fondi", () => {
    expect(logoSourceFor({ type: "etf", name: "ETF Azionario Globale Demo", isin: "IE00DEMO0001" })).toBeNull();
    expect(logoSourceFor({ type: "fondo", name: "Fondo Prudente Gamma", isin: null })).toBeNull();
  });

  it("per un'azione usa l'ISIN, se ha la forma giusta", () => {
    expect(logoSourceFor({ type: "azione", name: "Eni", isin: " it0003132476 " })).toEqual({ kind: "isin", isin: "IT0003132476", key: "isin:IT0003132476" });
    expect(logoSourceFor({ type: "azione", name: "Eni", isin: "../etc/passwd" })).toBeNull();
    expect(logoSourceFor({ type: "azione", name: "Eni", isin: null })).toBeNull();
  });

  it("non chiede loghi per crypto, obbligazioni ed ETC", () => {
    for (const type of ["crypto", "obbligazione", "etc"] as const) {
      expect(logoSourceFor({ type, name: "iShares Qualcosa", isin: "IE00B4L5Y983" })).toBeNull();
    }
  });
});
