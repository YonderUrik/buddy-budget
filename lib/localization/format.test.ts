import { describe, expect, it } from "vitest";
import { numberSeparators } from "./format";

describe("numberSeparators", () => {
  it("never returns the same thousand and decimal separator", () => {
    // Italian and Spanish leave 1234,5 ungrouped in some engines: the old 1234.5 probe returned "," for both.
    for (const locale of ["it-IT", "es-ES", "pl-PL", "de-DE", "en-GB", "en-US", "fr-FR", "de-CH"]) {
      const { thousand, decimal } = numberSeparators(locale);
      expect(thousand).not.toBe(decimal);
    }
  });

  it("uses the locale's own separators", () => {
    expect(numberSeparators("it-IT")).toEqual({ thousand: ".", decimal: "," });
    expect(numberSeparators("en-GB")).toEqual({ thousand: ",", decimal: "." });
    expect(numberSeparators("de-DE")).toEqual({ thousand: ".", decimal: "," });
  });
});
