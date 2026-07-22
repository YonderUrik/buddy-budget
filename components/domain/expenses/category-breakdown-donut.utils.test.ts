import { describe, expect, it } from "vitest";
import { computeBudgetStats, sortCategoryAmounts } from "./category-breakdown-donut.utils";
import type { CategoryAmount } from "@/lib/calc/expenses";

function makeEntry(overrides: Partial<CategoryAmount>): CategoryAmount {
  return {
    categoryId: "id",
    name: "Categoria",
    type: "variabile",
    amount: 0,
    color: "slate",
    icon: "package",
    ...overrides,
  };
}

describe("sortCategoryAmounts", () => {
  it("mette tutte le categorie fisse prima delle variabili", () => {
    const input = [
      makeEntry({ categoryId: "v1", type: "variabile", amount: 100 }),
      makeEntry({ categoryId: "f1", type: "fissa", amount: 10 }),
    ];
    const result = sortCategoryAmounts(input);
    expect(result.map((e) => e.categoryId)).toEqual(["f1", "v1"]);
  });

  it("dentro lo stesso tipo ordina per importo decrescente", () => {
    const input = [
      makeEntry({ categoryId: "f-low", type: "fissa", amount: 10 }),
      makeEntry({ categoryId: "f-high", type: "fissa", amount: 50 }),
    ];
    const result = sortCategoryAmounts(input);
    expect(result.map((e) => e.categoryId)).toEqual(["f-high", "f-low"]);
  });

  it("mantiene le categorie a importo zero nell'ordinamento", () => {
    const input = [
      makeEntry({ categoryId: "zero", type: "variabile", amount: 0 }),
      makeEntry({ categoryId: "speso", type: "variabile", amount: 20 }),
    ];
    const result = sortCategoryAmounts(input);
    expect(result.map((e) => e.categoryId)).toEqual(["speso", "zero"]);
  });

  it("non modifica l'array originale", () => {
    const input = [makeEntry({ categoryId: "a", amount: 1 }), makeEntry({ categoryId: "b", amount: 2 })];
    const originalOrder = input.map((e) => e.categoryId);
    sortCategoryAmounts(input);
    expect(input.map((e) => e.categoryId)).toEqual(originalOrder);
  });
});

describe("computeBudgetStats", () => {
  it("calcola la saturazione normale del budget", () => {
    expect(computeBudgetStats(50, 100, 200).saturazionePct).toBe(50);
  });

  it("saturazione oltre il 100% quando si supera il budget", () => {
    expect(computeBudgetStats(150, 100, 200).saturazionePct).toBe(150);
  });

  it("saturazione null se il budget è 0", () => {
    expect(computeBudgetStats(50, 0, 200).saturazionePct).toBeNull();
  });

  it("calcola la quota sul totale speso", () => {
    expect(computeBudgetStats(50, 100, 200).quotaPct).toBe(25);
  });

  it("quota null se il totale speso è 0", () => {
    expect(computeBudgetStats(0, 100, 0).quotaPct).toBeNull();
  });
});
