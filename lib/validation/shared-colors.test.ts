import { describe, expect, it } from "vitest";
import { SWATCH_COLORS } from "./shared-colors";
import { ACCOUNT_COLORS } from "./accounts";
import { CATEGORY_COLORS } from "./categories";

describe("SWATCH_COLORS", () => {
  it("ha 8 colori", () => {
    expect(SWATCH_COLORS).toHaveLength(8);
  });

  it("ACCOUNT_COLORS e CATEGORY_COLORS puntano alla stessa palette condivisa", () => {
    expect(ACCOUNT_COLORS).toEqual(SWATCH_COLORS);
    expect(CATEGORY_COLORS).toEqual(SWATCH_COLORS);
  });
});
