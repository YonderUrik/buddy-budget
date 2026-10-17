import { describe, expect, it } from "vitest";
import { addDaysKey, inDraft, monthGrid, monthKey, outOfBounds, pickRange, rangeSpan, shortRangeLabel } from "./calendar-range";

describe("monthGrid", () => {
  it("starts on Monday and always has six weeks", () => {
    const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ key: "2026-09-28", day: 28, inMonth: false });
    expect(grid[3]).toEqual({ key: "2026-10-01", day: 1, inMonth: true });
    expect(grid.filter((day) => day.inMonth)).toHaveLength(31);
  });

  it("handles a month that starts on Monday", () => {
    expect(monthGrid(2026, 5)[0].key).toBe("2026-06-01");
  });
});

describe("pickRange", () => {
  it("opens a range on the first tap and closes it on the second", () => {
    const first = pickRange({ from: "2026-01-01", to: "2026-02-01" }, "2026-03-10");
    expect(first).toEqual({ from: "2026-03-10", to: null });
    expect(pickRange(first, "2026-04-02")).toEqual({ from: "2026-03-10", to: "2026-04-02" });
  });

  it("moves the start when the second tap is earlier", () => {
    expect(pickRange({ from: "2026-03-10", to: null }, "2026-03-01")).toEqual({ from: "2026-03-01", to: null });
  });

  it("accepts a one-day range and works with month keys", () => {
    expect(pickRange({ from: "2026-03-10", to: null }, "2026-03-10")).toEqual({ from: "2026-03-10", to: "2026-03-10" });
    expect(pickRange({ from: "2025-01", to: null }, "2025-12")).toEqual({ from: "2025-01", to: "2025-12" });
  });
});

describe("range helpers", () => {
  it("checks membership, bounds and spans", () => {
    expect(inDraft({ from: "2026-01-05", to: "2026-01-09" }, "2026-01-07")).toBe(true);
    expect(inDraft({ from: "2026-01-05", to: null }, "2026-01-07")).toBe(false);
    expect(outOfBounds("2026-10-18", undefined, "2026-10-17")).toBe(true);
    expect(rangeSpan("2026-01-01", "2026-12-31", "day")).toBe(365);
    expect(rangeSpan("2026-03-28", "2026-03-30", "day")).toBe(3);
    expect(rangeSpan("2025-01", "2025-12", "month")).toBe(12);
  });

  it("normalises keys", () => {
    expect(monthKey(2025, 12)).toBe("2026-01");
    expect(addDaysKey("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysKey("2026-03-01", -7)).toBe("2026-02-22");
  });
});

describe("shortRangeLabel", () => {
  it("omits the year in the current year", () => {
    expect(shortRangeLabel("2026-03-03", "2026-10-17", "day", "it-IT", 2026)).toBe("3 mar – 17 ott");
  });

  it("writes the year when it is not obvious", () => {
    expect(shortRangeLabel("2025-12-01", "2026-01-31", "day", "it-IT", 2026)).toBe("1 dic 2025 – 31 gen 2026");
    expect(shortRangeLabel("2025-01", "2025-12", "month", "it-IT", 2026)).toBe("gen 2025 – dic 2025");
  });
});
