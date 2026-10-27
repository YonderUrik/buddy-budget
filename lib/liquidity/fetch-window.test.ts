import { describe, expect, it } from "vitest";
import { liquidityFetchWindow, previousYearWithMovements } from "./fetch-window";

describe("Liquidità fetch window", () => {
  it("starts on 1 January of the previous year", () => {
    expect(liquidityFetchWindow(new Date(2026, 9, 26))).toEqual({ from: "2025-01-01", to: "2026-12-31" });
  });
  it("offers the newest older year with movements, skipping empty years, until nothing is left", () => {
    const years = [2026, 2025, 2024, 2022];
    expect(previousYearWithMovements(years, "2025-01-01")).toBe(2024);
    expect(previousYearWithMovements(years, "2024-01-01")).toBe(2022);
    expect(previousYearWithMovements(years, "2022-01-01")).toBeNull();
    expect(previousYearWithMovements([], "2025-01-01")).toBeNull();
  });
});
