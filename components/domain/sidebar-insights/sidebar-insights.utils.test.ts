import { describe, expect, it } from "vitest";
import { changeToneClass, formatSidebarAmount, formatSidebarSignedAmount, HIDDEN_PLACEHOLDER } from "./sidebar-insights.utils";

describe("sidebar-insights.utils", () => {
  it("nasconde gli importi quando richiesto", () => {
    expect(formatSidebarAmount(12480, "EUR", true)).toBe(HIDDEN_PLACEHOLDER);
    expect(formatSidebarSignedAmount(320, "EUR", true)).toBe(HIDDEN_PLACEHOLDER);
    expect(formatSidebarAmount(12480, "EUR", false)).toMatch(/12\.480/);
  });

  it("mette il segno esplicito", () => {
    expect(formatSidebarSignedAmount(320, "EUR", false)).toMatch(/^\+320/);
    expect(formatSidebarSignedAmount(-45, "EUR", false)).toMatch(/^−45/);
  });

  it("sceglie il colore dalla variazione", () => {
    expect(changeToneClass(0.01)).toBe("text-pos");
    expect(changeToneClass(-0.01)).toBe("text-neg");
    expect(changeToneClass(0)).toContain("sidebar-foreground");
    expect(changeToneClass(null)).toContain("sidebar-foreground");
  });
});
