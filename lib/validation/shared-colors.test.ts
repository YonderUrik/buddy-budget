import { describe, expect, it } from "vitest";
import { SWATCH_BASE_COLORS, SWATCH_COLORS } from "./shared-colors";
import { ACCOUNT_COLORS } from "./accounts";
import { CATEGORY_COLORS } from "./categories";

describe("SWATCH_BASE_COLORS", () => {
  it("ha 16 colori base, nessun duplicato", () => {
    expect(SWATCH_BASE_COLORS).toHaveLength(16);
    expect(new Set(SWATCH_BASE_COLORS).size).toBe(16);
  });
});

describe("SWATCH_COLORS", () => {
  it("ha 48 colori (16 base + 32 varianti), nessun duplicato", () => {
    expect(SWATCH_COLORS).toHaveLength(48);
    expect(new Set(SWATCH_COLORS).size).toBe(48);
  });

  it("inizia con i 16 colori base nello stesso ordine di SWATCH_BASE_COLORS", () => {
    expect(SWATCH_COLORS.slice(0, 16)).toEqual(SWATCH_BASE_COLORS);
  });

  it("ogni colore base ha una variante -light e una -dark nel pool", () => {
    for (const base of SWATCH_BASE_COLORS) {
      expect(SWATCH_COLORS).toContain(`${base}-light`);
      expect(SWATCH_COLORS).toContain(`${base}-dark`);
    }
  });

  it("ACCOUNT_COLORS e CATEGORY_COLORS puntano alla stessa palette condivisa", () => {
    expect(ACCOUNT_COLORS).toEqual(SWATCH_COLORS);
    expect(CATEGORY_COLORS).toEqual(SWATCH_COLORS);
  });
});
