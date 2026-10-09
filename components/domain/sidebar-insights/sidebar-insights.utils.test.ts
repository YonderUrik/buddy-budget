import { describe, expect, it } from "vitest";
import {
  changeToneClass,
  fireBarWidth,
  formatDeadlineDay,
  formatFireProgress,
  formatSidebarAmount,
  formatSidebarSignedAmount,
  formatYearsToFire,
  HIDDEN_PLACEHOLDER,
} from "./sidebar-insights.utils";

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

describe("moduli scadenze e FIRE", () => {
  it("formatDeadlineDay separa giorno e mese abbreviato", () => {
    expect(formatDeadlineDay("2026-10-12")).toEqual({ day: "12", month: "ott" });
    expect(formatDeadlineDay("2026-01-05")).toEqual({ day: "5", month: "gen" });
  });

  it("formatFireProgress e fireBarWidth si fermano a 0 e 100", () => {
    expect(formatFireProgress(0.384)).toBe("38%");
    expect(formatFireProgress(1.4)).toBe("100%");
    expect(formatFireProgress(-0.1)).toBe("0%");
    expect(fireBarWidth(2)).toBe(100);
    expect(fireBarWidth(0.5)).toBe(50);
  });

  it("formatYearsToFire descrive gli anni in parole", () => {
    expect(formatYearsToFire(null)).toBeNull();
    expect(formatYearsToFire(0)).toBe("raggiunto");
    expect(formatYearsToFire(0.4)).toBe("tra meno di un anno");
    expect(formatYearsToFire(1.2)).toBe("tra 1 anno");
    expect(formatYearsToFire(11.6)).toBe("tra 12 anni");
  });
});
