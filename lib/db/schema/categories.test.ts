import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/validation/categories";
import { DEFAULT_CATEGORIES } from "./categories";

describe("DEFAULT_CATEGORIES", () => {
  it("ha 18 categorie", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(18);
  });

  it("ogni categoria ha icona e colore validi", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(CATEGORY_ICONS).toContain(category.icon);
      expect(CATEGORY_COLORS).toContain(category.color);
    }
  });

  it("solo 'Da categorizzare' è isFallback", () => {
    const fallbackEntries = DEFAULT_CATEGORIES.filter((c) => c.isFallback === true);
    expect(fallbackEntries).toHaveLength(1);
    expect(fallbackEntries[0].name).toBe("Da categorizzare");
  });

  it("ha 3 categorie di tipo entrata: Stipendio, Freelance, Dividendi e interessi", () => {
    const incomeEntries = DEFAULT_CATEGORIES.filter((c) => c.type === "entrata");
    expect(incomeEntries.map((c) => c.name).sort()).toEqual(
      ["Dividendi e interessi", "Freelance", "Stipendio"].sort()
    );
  });
});
