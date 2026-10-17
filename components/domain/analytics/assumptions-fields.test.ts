import { describe, expect, it } from "vitest";
import { localizedNumberFields, parseNumber, toFieldText } from "./assumptions-fields";

describe("parseNumber", () => {
  it("reads Italian numbers by default", () => {
    expect(parseNumber("3,5")).toBe(3.5);
    expect(parseNumber("1.250,5")).toBe(1250.5);
    expect(parseNumber("24.000")).toBe(24000);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });

  it("follows the separators of the locale", () => {
    expect(parseNumber("1,250.5", "en-GB")).toBe(1250.5);
    expect(parseNumber("24,000", "en-GB")).toBe(24000);
    expect(parseNumber("3.5", "en-GB")).toBe(3.5);
    expect(parseNumber("1.250,5", "de-DE")).toBe(1250.5);
  });
});

describe("toFieldText", () => {
  it("writes the decimal separator of the locale", () => {
    expect(toFieldText(0.035, true)).toBe("3,5");
    expect(toFieldText(0.035, true, "en-GB")).toBe("3.5");
    expect(toFieldText(0.035, true, "de-DE")).toBe("3,5");
    expect(toFieldText(24000.4, false, "en-GB")).toBe("24000");
    expect(toFieldText(null, true, "en-GB")).toBe("");
  });

  it("reads back what it wrote", () => {
    for (const locale of ["it-IT", "en-GB", "de-DE"]) {
      const { parseNumber: parse, toFieldText: format } = localizedNumberFields(locale);
      expect(parse(format(0.0125, true))).toBe(1.25);
      expect(parse(Math.round(24000).toLocaleString(locale))).toBe(24000);
    }
  });
});
