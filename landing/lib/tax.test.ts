import { describe, expect, it } from "vitest";
import { estimateSale } from "./tax";

describe("estimateSale", () => {
  it("applica il 26% al guadagno su azioni ed ETF", () => {
    expect(estimateSale(10000, 13000, "azioni_etf")).toEqual({ gain: 3000, tax: 780, net: 12220 });
  });
  it("applica il 12,5% sui titoli di Stato", () => {
    expect(estimateSale(10000, 13000, "titoli_stato").tax).toBe(375);
  });
  it("non tassa una perdita", () => {
    expect(estimateSale(10000, 8000, "azioni_etf")).toEqual({ gain: -2000, tax: 0, net: 8000 });
  });
});
