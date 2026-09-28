import { describe, expect, it } from "vitest";
import { buildFxTable, convertAmount, fxRateBetween, getPerEur } from "./fx";

const table = buildFxTable([
  { date: "2026-09-24", currency: "USD", perEur: "1.10" },
  { date: "2026-09-25", currency: "USD", perEur: "1.20" },
  { date: "2026-09-25", currency: "GBP", perEur: "0.80" },
]);

describe("fx", () => {
  it("l'EUR vale sempre 1", () => {
    expect(getPerEur(table, "EUR", "2000-01-01")).toBe(1);
  });

  it("usa l'ultimo cambio disponibile prima della data (weekend e festivi)", () => {
    expect(getPerEur(table, "USD", "2026-09-27")).toBe(1.2);
    expect(getPerEur(table, "USD", "2026-09-24")).toBe(1.1);
  });

  it("restituisce null prima del primo cambio o per valute sconosciute", () => {
    expect(getPerEur(table, "USD", "2026-09-01")).toBeNull();
    expect(getPerEur(table, "JPY", "2026-09-25")).toBeNull();
  });

  it("converte tra due valute passando dall'EUR", () => {
    expect(convertAmount(table, 120, "USD", "EUR", "2026-09-25")).toBeCloseTo(100);
    expect(convertAmount(table, 100, "EUR", "USD", "2026-09-25")).toBeCloseTo(120);
    expect(fxRateBetween(table, "USD", "GBP", "2026-09-25")).toBeCloseTo(0.8 / 1.2);
    expect(convertAmount(table, 50, "USD", "USD", "1990-01-01")).toBe(50);
  });

  it("restituisce null se manca un cambio", () => {
    expect(convertAmount(table, 100, "JPY", "EUR", "2026-09-25")).toBeNull();
  });

  it("scarta cambi non validi", () => {
    const bad = buildFxTable([{ date: "2026-09-25", currency: "USD", perEur: "0" }]);
    expect(getPerEur(bad, "USD", "2026-09-25")).toBeNull();
  });
});
