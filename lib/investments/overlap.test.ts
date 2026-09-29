import { describe, expect, it } from "vitest";
import { resolveInstrumentExposure, type ExposureInstrument, type ExposureProfile } from "./exposure";
import { baseTicker, computeFundOverlaps, computeStocksInsideFunds, holdingsOverlap, normalizeCompanyName, type OverlapInput } from "./overlap";

function input(id: string, type: ExposureInstrument["type"], name: string, value: number, profile: Partial<ExposureProfile> | null = null): OverlapInput {
  const instrument: ExposureInstrument = { id, type, name, isin: null };
  const fullProfile = profile
    ? { instrumentId: id, symbol: null, sectors: null, assetMix: null, holdings: null, sector: null, country: null, ...profile }
    : null;
  return { instrument, value, exposure: resolveInstrumentExposure(instrument, fullProfile, null), profile: fullProfile };
}

describe("nomi e ticker", () => {
  it("riduce i nomi delle aziende all'essenziale", () => {
    expect(normalizeCompanyName("Apple Inc.")).toBe("apple");
    expect(normalizeCompanyName("ENEL S.p.A.")).toBe("enel");
    expect(normalizeCompanyName("Alphabet Inc Class A")).toBe("alphabet");
    expect(baseTicker("ENEL.MI")).toBe("ENEL");
    expect(baseTicker(null)).toBeNull();
  });

  it("sovrapposizione dei primi titoli: somma dei pesi minimi sui titoli in comune", () => {
    const a = [
      { symbol: "AAPL", name: "Apple Inc", weight: 0.05 },
      { symbol: "MSFT", name: "Microsoft Corp", weight: 0.04 },
    ];
    const b = [
      { symbol: null, name: "Apple Inc.", weight: 0.07 },
      { symbol: "NVDA", name: "NVIDIA", weight: 0.06 },
    ];
    expect(holdingsOverlap(a, b)).toBeCloseTo(0.05);
  });
});

describe("computeFundOverlaps", () => {
  it("stesso indice = 100%, World e All-World ≈ 88% dalle aree", () => {
    const overlaps = computeFundOverlaps([
      input("vwce", "etf", "Vanguard FTSE All-World", 1000),
      input("swda", "etf", "iShares Core MSCI World", 1000),
      input("iwda", "etf", "iShares Core MSCI World USD", 500),
    ]);
    expect(overlaps[0]).toMatchObject({ method: "stesso_indice", share: 1 });
    expect(overlaps.find((o) => o.aId === "vwce" && o.bId === "swda")).toMatchObject({ method: "aree_indici" });
    expect(overlaps.find((o) => o.aId === "vwce" && o.bId === "swda")!.share).toBeCloseTo(0.88);
  });

  it("senza stima d'indice usa i primi titoli e scarta le coppie sotto il 20%", () => {
    const holdings = [{ symbol: "AAPL", name: "Apple", weight: 0.25 }];
    const overlaps = computeFundOverlaps([
      input("a", "etf", "Tematico A", 100, { holdings }),
      input("b", "fondo", "Tematico B", 100, { holdings }),
      input("c", "etf", "Tematico C", 100, { holdings: [{ symbol: "AAPL", name: "Apple", weight: 0.1 }] }),
    ]);
    expect(overlaps).toEqual([{ aId: "a", bId: "b", share: 0.25, method: "primi_titoli" }]);
  });
});

describe("computeStocksInsideFunds", () => {
  it("somma l'esposizione a un'azione posseduta sia direttamente sia tra i primi titoli di più ETF", () => {
    const found = computeStocksInsideFunds([
      input("aapl", "azione", "Apple Inc.", 500, { symbol: "AAPL" }),
      input("vwce", "etf", "Vanguard FTSE All-World", 10_000, { holdings: [{ symbol: "AAPL", name: "Apple Inc", weight: 0.04 }] }),
      input("swda", "etf", "iShares Core MSCI World", 1_000, { holdings: [{ symbol: null, name: "APPLE INC", weight: 0.05 }] }),
      input("enel", "azione", "Enel", 300, { symbol: "ENEL.MI" }),
    ]);
    expect(found).toEqual([
      {
        stockId: "aapl",
        directValue: 500,
        funds: [
          { fundId: "vwce", weightInFund: 0.04, viaFundValue: 400 },
          { fundId: "swda", weightInFund: 0.05, viaFundValue: 50 },
        ],
        totalValue: 950,
      },
    ]);
  });
});
