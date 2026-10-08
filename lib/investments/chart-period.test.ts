import { describe, expect, it } from "vitest";
import { portfolioChartRange, validChartRange } from "./chart-period";

describe("portfolio chart dates", () => {
  it("starts YTD at January 1, including on January 1 itself", () => {
    expect(portfolioChartRange("ytd", { from: "2020-01-01", to: "2020-12-31" }, "2026-01-01")).toEqual({ from: "2026-01-01", to: "2026-01-01" });
  });
  it("accepts leap days and single days but rejects rollover, reversed and future dates", () => {
    expect(validChartRange({ from: "2024-02-29", to: "2024-02-29" }, "2026-10-06")).toBe(true);
    for (const range of [{ from: "2025-02-29", to: "2025-03-01" }, { from: "2026-10-06", to: "2026-01-01" }, { from: "", to: "2026-01-01" }, { from: "2026-01-01", to: "2027-01-01" }]) {
      expect(validChartRange(range, "2026-10-06")).toBe(false);
    }
  });
});
