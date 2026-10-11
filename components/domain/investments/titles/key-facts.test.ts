import { describe, expect, it } from "vitest";
import { EMPTY_FUNDAMENTALS } from "@/lib/market-data/fake";
import { keyFacts } from "./key-facts";

const stats = {
  lastClose: 7.1, lastDate: "2026-10-09", dayChange: -0.008, returns: { "1A": 0.16, YTD: 0.05 },
  high52: 7.4, low52: 5.5, fromHigh: -0.04, volatility: 0.18, maxDrawdown: -0.1,
};

describe("keyFacts", () => {
  it("per un ETF mostra TER, patrimonio, categoria e i numeri di rischio", () => {
    const facts = keyFacts({
      type: "etf", currency: "EUR", stats, stock: null, dividends: null,
      fundamentals: { ...EMPTY_FUNDAMENTALS, expenseRatio: 0.0022, totalAssets: 8.5e9, fundCategory: "Azionario globale" },
    });
    expect(facts.map((f) => f.label)).toEqual(["Costo annuo (TER)", "Patrimonio", "Categoria", "Volatilità", "Dal massimo"]);
    expect(facts[0]).toMatchObject({ value: "0,22%", note: "22 EUR ogni 10.000" });
  });

  it("per un'azione senza bilanci usa i numeri chiave di Yahoo e salta quelli mancanti", () => {
    const facts = keyFacts({ type: "azione", currency: "EUR", stats, stock: null, dividends: null, fundamentals: { ...EMPTY_FUNDAMENTALS, trailingPE: 14.2 } });
    expect(facts.map((f) => f.label)).toEqual(["P/E", "Volatilità", "Dal massimo"]);
    expect(facts[0].value).toBe("14,2");
  });

  it("per un'obbligazione mostra le variazioni", () => {
    const facts = keyFacts({ type: "obbligazione", currency: "EUR", stats, stock: null, dividends: null, fundamentals: null });
    expect(facts.map((f) => f.label)).toEqual(["1 anno", "Da inizio anno", "Volatilità", "Dal massimo"]);
  });
});
