import { describe, expect, it } from "vitest";
import { formatDecimal, formatMinusPct, formatPct, formatSignedPct, shortMonthLabel } from "./percent";

describe("percent helpers", () => {
  it("keep the Italian output by default", () => {
    expect(formatPct(0.042)).toBe("4,2%");
    expect(formatPct(0.0022, 2)).toBe("0,22%");
    expect(formatSignedPct(0.045)).toBe("+4,5%");
    expect(formatSignedPct(-0.02)).toBe("−2,0%");
    expect(formatMinusPct(-0.123, 0)).toBe("−12%");
    expect(formatDecimal(0.853, 2)).toBe("0,85");
    expect(shortMonthLabel("2026-09")).toBe("set");
  });

  it("follow the user's locale", () => {
    expect(formatPct(0.042, 1, "en-GB")).toBe("4.2%");
    expect(formatPct(0.042, 1, "de-DE")).toBe("4,2 %");
    expect(formatSignedPct(-0.02, "en-GB")).toBe("−2.0%");
    expect(formatMinusPct(-0.123, 1, "en-GB")).toBe("−12.3%");
    expect(formatDecimal(-0.35, 2, "en-GB")).toBe("-0.35");
    expect(formatDecimal(1234.5, 1, "de-DE")).toBe("1234,5");
    expect(shortMonthLabel(10, "de-DE")).toBe("Okt");
  });
});
