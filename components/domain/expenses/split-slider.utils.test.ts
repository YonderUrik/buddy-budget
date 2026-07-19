import { describe, expect, it } from "vitest";
import { clampExcluded, computeSplitExcluded } from "./split-slider.utils";

describe("clampExcluded", () => {
  it("passa invariato un valore già nel range", () => {
    expect(clampExcluded(5, 10)).toBe(5);
  });

  it("clampa un valore negativo a 0", () => {
    expect(clampExcluded(-3, 10)).toBe(0);
  });

  it("clampa un valore superiore al totale al totale", () => {
    expect(clampExcluded(15, 10)).toBe(10);
  });

  it("converte NaN in 0", () => {
    expect(clampExcluded(NaN, 10)).toBe(0);
  });
});

describe("computeSplitExcluded", () => {
  it("diviso 2: la quota esclusa è metà del totale", () => {
    expect(computeSplitExcluded(10, 2)).toBe(5);
  });

  it("diviso 3 con importo con centesimi (es. 1.44)", () => {
    expect(computeSplitExcluded(1.44, 3)).toBeCloseTo(0.96, 10);
  });

  it("diviso 4: la quota esclusa è 3/4 del totale", () => {
    expect(computeSplitExcluded(100, 4)).toBe(75);
  });

  it("clampa il risultato anche per n non intero o estremo (n=1: nessuna quota esclusa)", () => {
    expect(computeSplitExcluded(50, 1)).toBe(0);
  });
});
