import { describe, expect, it } from "vitest";
import { computeSavingsRate, getTrendRange } from "./movements";

describe("getTrendRange", () => {
  it("copre 6 mesi che finiscono nel mese guardato", () => {
    const range = getTrendRange("mese", new Date(2026, 8, 30));
    expect(range.from).toEqual(new Date(2026, 3, 1));
    expect(range.to).toEqual(new Date(2026, 8, 30));
  });

  it("copre 12 mesi per il periodo anno", () => {
    const range = getTrendRange("anno", new Date(2026, 11, 15));
    expect(range.from).toEqual(new Date(2026, 0, 1));
    expect(range.to).toEqual(new Date(2026, 11, 31));
  });

  it("non sfora di mese partendo da un giorno 31", () => {
    const range = getTrendRange("3mesi", new Date(2026, 6, 31));
    expect(range.from).toEqual(new Date(2026, 1, 1));
  });
});

describe("computeSavingsRate", () => {
  it("è la quota delle entrate non spesa", () => {
    expect(computeSavingsRate(1000, 750)).toBeCloseTo(0.25);
  });
  it("è negativa se si spende più di quanto si incassa", () => {
    expect(computeSavingsRate(1000, 1200)).toBeCloseTo(-0.2);
  });
  it("è null senza entrate", () => {
    expect(computeSavingsRate(0, 300)).toBeNull();
  });
});
