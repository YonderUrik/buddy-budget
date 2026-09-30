import { describe, expect, it } from "vitest";
import { buildSidebarPortfolio } from "./portfolio";

const instrument = { id: "i1", name: "Vanguard All-World", type: "etf" as const, currency: "EUR", priceUnit: "unita" as const };
const tx = (over: Partial<Parameters<typeof buildSidebarPortfolio>[0]["transactions"][number]>) => ({
  id: "t1", instrumentId: "i1", type: "acquisto" as const, date: "2026-09-01", quantity: "10", price: "100",
  fxRate: "1", fees: "0", taxes: "0", grossAmount: null, ...over,
});

describe("buildSidebarPortfolio", () => {
  const base = {
    instruments: [instrument],
    prices: [
      { instrumentId: "i1", date: "2026-09-29", close: "110", source: "yahoo" as const },
      { instrumentId: "i1", date: "2026-09-30", close: "111", source: "yahoo" as const },
    ],
    manualPrices: [],
    fxRates: [],
    userCurrency: "EUR",
    todayKey: "2026-09-30",
    signals: new Map([["i1", { label: "VWCE", dayChangePct: 111 / 110 - 1, spark: [110, 111], triggeredAlerts: 1 }]]),
  };

  it("è null senza posizioni aperte", () => {
    expect(buildSidebarPortfolio({ ...base, transactions: [] })).toBeNull();
    expect(buildSidebarPortfolio({ ...base, transactions: [tx({}), tx({ id: "t2", type: "vendita" })] })).toBeNull();
  });

  it("calcola valore, variazione del giorno e guadagno; unisce i segnali", () => {
    const p = buildSidebarPortfolio({ ...base, transactions: [tx({})] })!;
    expect(p.totalValue).toBeCloseTo(1110, 6);
    expect(p.dayChange).toBeCloseTo(10, 6);
    expect(p.totalGain).toBeCloseTo(110, 6);
    expect(p.totalGainPct).toBeCloseTo(0.11, 6);
    expect(p.holdings).toEqual([
      { instrumentId: "i1", label: "VWCE", name: "Vanguard All-World", value: 1110, dayChangePct: 111 / 110 - 1, spark: [110, 111], triggeredAlerts: 1 },
    ]);
  });

  it("usa il nome se non c'è una sigla", () => {
    const p = buildSidebarPortfolio({ ...base, signals: new Map(), transactions: [tx({})] })!;
    expect(p.holdings[0].label).toBe("Vanguard All-World");
  });
});
