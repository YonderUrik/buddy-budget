import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/validation/categories";
import { CATEGORY_TYPES, EXPENSE_GROUP_KEYS } from "@/lib/categories/groups";
import { DEFAULT_CATEGORIES, LEGACY_CATEGORY_NAMES } from "./categories";

describe("DEFAULT_CATEGORIES", () => {
  it("ha 33 categorie con nomi unici", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(33);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.name)).size).toBe(33);
  });

  it("ogni categoria ha icona, colore e tipo validi", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(CATEGORY_ICONS).toContain(category.icon);
      expect(CATEGORY_COLORS).toContain(category.color);
      expect(CATEGORY_TYPES).toContain(category.type);
    }
  });

  it("solo 'Da categorizzare' è isFallback, rossa con help-circle", () => {
    const fallbackEntries = DEFAULT_CATEGORIES.filter((c) => c.isFallback === true);
    expect(fallbackEntries).toHaveLength(1);
    expect(fallbackEntries[0]).toMatchObject({ name: "Da categorizzare", color: "red", icon: "help-circle" });
  });

  it("ogni gruppo di spesa ha almeno una categoria non fallback", () => {
    for (const group of EXPENSE_GROUP_KEYS) {
      expect(DEFAULT_CATEGORIES.some((c) => c.type === group && !c.isFallback)).toBe(true);
    }
  });

  it("ha 5 categorie di tipo entrata", () => {
    const incomeEntries = DEFAULT_CATEGORIES.filter((c) => c.type === "entrata");
    expect(incomeEntries.map((c) => c.name).sort()).toEqual(
      ["Altre entrate", "Dividendi e interessi", "Freelance", "Rimborsi", "Stipendio"].sort()
    );
  });

  it("ogni nome legacy punta a una categoria di default esistente", () => {
    const names = new Set(DEFAULT_CATEGORIES.map((c) => c.name));
    for (const target of Object.values(LEGACY_CATEGORY_NAMES)) {
      expect(names.has(target)).toBe(true);
    }
  });

  it("nessun nome legacy coincide con un nome di default attuale", () => {
    const names = new Set(DEFAULT_CATEGORIES.map((c) => c.name));
    for (const key of Object.keys(LEGACY_CATEGORY_NAMES)) {
      expect(names.has(key)).toBe(false);
    }
  });
});
