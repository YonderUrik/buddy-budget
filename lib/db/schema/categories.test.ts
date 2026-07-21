import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/validation/categories";
import { DEFAULT_CATEGORIES } from "./categories";

describe("DEFAULT_CATEGORIES", () => {
  it("ha 9 categorie", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(9);
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
});
