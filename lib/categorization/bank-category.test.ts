import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/categories/defaults";
import { buildBankCategoryMapper, cleanBankCategory, learnFromCorrections, normalizeBankCategory, type BankCategoryTarget } from "./bank-category";

const defaults: BankCategoryTarget[] = DEFAULT_CATEGORIES.map((category) => ({
  id: category.key,
  name: category.name,
  type: category.type,
  defaultKey: category.key,
  isFallback: category.isFallback ?? false,
}));

const mapper = buildBankCategoryMapper(defaults);
const target = (label: string, amount = -10) => mapper.map(label, amount)?.categoryId ?? null;

describe("normalizeBankCategory and cleanBankCategory", () => {
  it("normalises case, accents and punctuation", () => {
    expect(normalizeBankCategory("  Bar & Ristoranti ")).toBe("bar ristoranti");
    expect(normalizeBankCategory("Mobilität/Öffis")).toBe("mobilitat offis");
    expect(normalizeBankCategory("Straßenbahn")).toBe("strassenbahn");
  });

  it("drops empty, numeric and over-long labels", () => {
    expect(cleanBankCategory("  ")).toBeNull();
    expect(cleanBankCategory("12,50")).toBeNull();
    expect(cleanBankCategory("x".repeat(101))).toBeNull();
    expect(cleanBankCategory("  Spesa   alimentare ")).toBe("Spesa alimentare");
  });
});

describe("buildBankCategoryMapper", () => {
  it("matches the user's category by name, also one part of a combined name and plurals", () => {
    expect(mapper.map("Spesa", -40)).toEqual({ categoryId: "spesa", kind: "name" });
    expect(target("Ristoranti")).toBe("ristoranti");
    expect(target("Bar")).toBe("ristoranti");
    expect(target("Sport")).toBe("benessere");
    expect(target("Stipendio", 1800)).toBe("stipendio");
  });

  it("matches names in the user's other languages", () => {
    expect(target("Groceries")).toBe("spesa");
  });

  it("maps common Italian, English and German bank labels through the dictionary", () => {
    expect(mapper.map("Ristorazione", -25)).toEqual({ categoryId: "ristoranti", kind: "dictionary" });
    expect(target("Alimentari e supermercati")).toBe("spesa");
    expect(target("Carburanti")).toBe("trasporti");
    expect(target("Utenze domestiche")).toBe("bollette");
    expect(target("Food & Groceries")).toBe("spesa");
    expect(target("Bars & Restaurants")).toBe("ristoranti");
    expect(target("Transport & Car")).toBe("trasporti");
    expect(target("Health & Drugstores")).toBe("salute");
    expect(target("Household & Utilities")).toBe("bollette");
    expect(target("Lebensmittel")).toBe("spesa");
    expect(target("Mobilität")).toBe("trasporti");
    expect(target("Versicherungen")).toBe("assicurazioni");
    expect(target("Prelievi bancomat")).toBe("contanti");
    expect(target("Gehalt", 2500)).toBe("stipendio");
    expect(target("Zinsen", 3)).toBe("interessi");
  });

  it("tries the most specific level of a hierarchical label first", () => {
    expect(target("Casa > Bollette")).toBe("bollette");
    expect(target("Tempo libero / Altro")).toBe("svago");
  });

  it("does not match whole-word terms inside other words", () => {
    expect(target("Barbiere")).toBeNull();
    expect(target("Pagamenti diversi")).toBeNull();
  });

  it("respects the direction of the amount", () => {
    expect(target("Ristoranti", 15)).toBeNull();
    expect(target("Stipendio", -100)).toBeNull();
    expect(target("Rimborsi", 30)).toBe("rimborsi");
  });

  it("never maps generic labels, transfers or zero amounts", () => {
    expect(target("Altro")).toBeNull();
    expect(target("Varie")).toBeNull();
    expect(target("Other")).toBeNull();
    expect(target("Trasferimenti")).toBeNull();
    expect(target("Giroconto")).toBeNull();
    expect(mapper.map("Spesa", 0)).toBeNull();
    expect(mapper.map(null, -10)).toBeNull();
  });

  it("skips default categories the user deleted, and finds renamed defaults by key", () => {
    const withoutGroceries = buildBankCategoryMapper(defaults.filter((category) => category.id !== "spesa"));
    expect(withoutGroceries.map("Supermercati", -10)).toBeNull();
    const renamed = buildBankCategoryMapper(defaults.map((category) => (category.id === "spesa" ? { ...category, name: "Cibo di casa" } : category)));
    expect(renamed.map("Supermercati", -10)?.categoryId).toBe("spesa");
  });

  it("recognises older default categories without a stored key by their name", () => {
    const legacy = buildBankCategoryMapper(defaults.map((category) => ({ ...category, defaultKey: null })));
    expect(legacy.map("Supermercati", -10)?.categoryId).toBe("spesa");
  });

  it("matches the user's own categories by name and never an ambiguous one", () => {
    const custom: BankCategoryTarget[] = [
      { id: "fuel", name: "Carburante", type: "dovuta", defaultKey: null, isFallback: false },
      { id: "a", name: "Gatti", type: "voluta", defaultKey: null, isFallback: false },
      { id: "b", name: "Gatto", type: "dovuta", defaultKey: null, isFallback: false },
    ];
    const own = buildBankCategoryMapper(custom);
    expect(own.map("Carburanti", -60)).toEqual({ categoryId: "fuel", kind: "name" });
    expect(own.map("Gatti", -10)).toBeNull();
  });

  it("follows what the user taught before anything else", () => {
    const learned = new Map([["ristorazione", "svago"]]);
    expect(buildBankCategoryMapper(defaults, learned).map("RISTORAZIONE", -10)).toEqual({ categoryId: "svago", kind: "learned" });
    // A learned category that no longer fits the direction is ignored.
    expect(buildBankCategoryMapper(defaults, new Map([["ristorazione", "stipendio"]])).map("Ristorazione", -10)?.kind).toBe("dictionary");
  });
});

describe("learnFromCorrections", () => {
  it("learns a label once enough choices agree and the winner is clear", () => {
    const learned = learnFromCorrections([
      { bankCategory: "Ristorazione", categoryId: "svago" },
      { bankCategory: "ristorazione ", categoryId: "svago" },
      { bankCategory: "Ristorazione", categoryId: "ristoranti" },
      { bankCategory: "Viaggi", categoryId: "svago" },
      { bankCategory: "Casa", categoryId: "casa" },
      { bankCategory: "Casa", categoryId: "casa" },
      { bankCategory: "Casa", categoryId: "affitto" },
      { bankCategory: "Casa", categoryId: "affitto" },
    ]);
    expect(learned.get("ristorazione")).toBe("svago");
    expect(learned.has("viaggi")).toBe(false);
    expect(learned.has("casa")).toBe(false);
  });
});
