import { describe, expect, it } from "vitest";
import { computeBudgetStats, sortCategoryAmounts, sortLegendEntries } from "./category-breakdown-donut.utils";
import type { CategoryAmount } from "@/lib/calc/expenses";
import type { LegendEntry } from "./category-breakdown-donut.utils";

function makeEntry(overrides: Partial<CategoryAmount>): CategoryAmount {
  return {
    categoryId: "id",
    name: "Categoria",
    group: "voluta",
    amount: 0,
    color: "slate",
    icon: "package",
    ...overrides,
  };
}

describe("sortCategoryAmounts", () => {
  it("ordina per gruppo: dovute, volute, te futuro, saltuarie, da categorizzare in coda", () => {
    const input = [
      makeEntry({ categoryId: "fb", group: "daCategorizzare", amount: 999 }),
      makeEntry({ categoryId: "sal", group: "saltuaria", amount: 10 }),
      makeEntry({ categoryId: "vol", group: "voluta", amount: 100 }),
      makeEntry({ categoryId: "fut", group: "futuro", amount: 5 }),
      makeEntry({ categoryId: "dov", group: "dovuta", amount: 1 }),
    ];
    expect(sortCategoryAmounts(input).map((e) => e.categoryId)).toEqual(["dov", "vol", "fut", "sal", "fb"]);
  });

  it("dentro lo stesso gruppo ordina per importo decrescente", () => {
    const input = [
      makeEntry({ categoryId: "d-low", group: "dovuta", amount: 10 }),
      makeEntry({ categoryId: "d-high", group: "dovuta", amount: 50 }),
    ];
    expect(sortCategoryAmounts(input).map((e) => e.categoryId)).toEqual(["d-high", "d-low"]);
  });

  it("mantiene le categorie a importo zero nell'ordinamento", () => {
    const input = [
      makeEntry({ categoryId: "zero", group: "voluta", amount: 0 }),
      makeEntry({ categoryId: "speso", group: "voluta", amount: 20 }),
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

function makeLegendEntry(overrides: Partial<LegendEntry>): LegendEntry {
  return {
    categoryId: "id",
    name: "Categoria",
    group: "voluta",
    amount: 0,
    color: "slate",
    icon: "package",
    budgetAmount: 0,
    saturazionePct: null,
    quotaPct: null,
    ...overrides,
  };
}

describe("sortLegendEntries", () => {
  it("ordina per percentuale sul totale decrescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", quotaPct: 10 }),
      makeLegendEntry({ categoryId: "high", quotaPct: 80 }),
    ];
    const result = sortLegendEntries(input, "percentuale", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["high", "low"]);
  });

  it("ordina per percentuale sul totale crescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", quotaPct: 10 }),
      makeLegendEntry({ categoryId: "high", quotaPct: 80 }),
    ];
    const result = sortLegendEntries(input, "percentuale", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["low", "high"]);
  });

  it("ordina per valore speso decrescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", amount: 5 }),
      makeLegendEntry({ categoryId: "high", amount: 50 }),
    ];
    const result = sortLegendEntries(input, "valore", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["high", "low"]);
  });

  it("ordina per valore speso crescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", amount: 5 }),
      makeLegendEntry({ categoryId: "high", amount: 50 }),
    ];
    const result = sortLegendEntries(input, "valore", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["low", "high"]);
  });

  it("ordina per saturazione budget decrescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", saturazionePct: 20 }),
      makeLegendEntry({ categoryId: "high", saturazionePct: 90 }),
    ];
    const result = sortLegendEntries(input, "budget", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["high", "low"]);
  });

  it("ordina per saturazione budget crescente", () => {
    const input = [
      makeLegendEntry({ categoryId: "low", saturazionePct: 20 }),
      makeLegendEntry({ categoryId: "high", saturazionePct: 90 }),
    ];
    const result = sortLegendEntries(input, "budget", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["low", "high"]);
  });

  it("ordina per nome A-Z", () => {
    const input = [
      makeLegendEntry({ categoryId: "z", name: "Zaino" }),
      makeLegendEntry({ categoryId: "a", name: "Affitto" }),
    ];
    const result = sortLegendEntries(input, "nome", "asc");
    expect(result.map((e) => e.categoryId)).toEqual(["a", "z"]);
  });

  it("ordina per nome Z-A", () => {
    const input = [
      makeLegendEntry({ categoryId: "z", name: "Zaino" }),
      makeLegendEntry({ categoryId: "a", name: "Affitto" }),
    ];
    const result = sortLegendEntries(input, "nome", "desc");
    expect(result.map((e) => e.categoryId)).toEqual(["z", "a"]);
  });

  it("mette le percentuali null sempre in fondo, indipendentemente dalla direzione", () => {
    const input = [
      makeLegendEntry({ categoryId: "no-budget", quotaPct: null }),
      makeLegendEntry({ categoryId: "has-value", quotaPct: 50 }),
    ];
    const desc = sortLegendEntries(input, "percentuale", "desc");
    expect(desc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
    const asc = sortLegendEntries(input, "percentuale", "asc");
    expect(asc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
  });

  it("mette le saturazioni budget null sempre in fondo, indipendentemente dalla direzione", () => {
    const input = [
      makeLegendEntry({ categoryId: "no-budget", saturazionePct: null }),
      makeLegendEntry({ categoryId: "has-value", saturazionePct: 50 }),
    ];
    const desc = sortLegendEntries(input, "budget", "desc");
    expect(desc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
    const asc = sortLegendEntries(input, "budget", "asc");
    expect(asc.map((e) => e.categoryId)).toEqual(["has-value", "no-budget"]);
  });

  it("non genera errori quando tutti i valori sono null", () => {
    const input = [
      makeLegendEntry({ categoryId: "a", quotaPct: null }),
      makeLegendEntry({ categoryId: "b", quotaPct: null }),
    ];
    const result = sortLegendEntries(input, "percentuale", "desc");
    expect(result.map((e) => e.categoryId).sort()).toEqual(["a", "b"]);
  });

  it("non modifica l'array originale", () => {
    const input = [
      makeLegendEntry({ categoryId: "a", amount: 1 }),
      makeLegendEntry({ categoryId: "b", amount: 2 }),
    ];
    const originalOrder = input.map((e) => e.categoryId);
    sortLegendEntries(input, "valore", "desc");
    expect(input.map((e) => e.categoryId)).toEqual(originalOrder);
  });
});
