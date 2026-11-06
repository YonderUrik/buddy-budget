import { describe, expect, it } from "vitest";
import { MAX_INITIAL_WINDOWS, planWindows, spanDays } from "./windows";

describe("planWindows", () => {
  it("imports the history from the opening date in chunks of at most 365 days, oldest first, without gaps", () => {
    const windows = planWindows({ existing: [], through: "2026-11-05", dateOpened: "2024-03-10" });
    expect(windows[0].from).toBe("2024-03-10");
    expect(windows.at(-1)!.to).toBe("2026-11-05");
    for (const w of windows) expect(spanDays(w.from, w.to)).toBeLessThanOrEqual(365);
    for (let i = 1; i < windows.length; i++) expect(spanDays(windows[i - 1].to, windows[i].from)).toBe(2);
  });

  it("starts one year back without an opening date, and bounds very long histories", () => {
    expect(planWindows({ existing: [], through: "2026-11-05", dateOpened: null })).toEqual([{ from: "2025-11-06", to: "2026-11-05" }]);
    const long = planWindows({ existing: [], through: "2026-11-05", dateOpened: "1999-01-01" });
    expect(long).toHaveLength(MAX_INITIAL_WINDOWS);
    expect(long.at(-1)!.to).toBe("2026-11-05");
  });

  it("re-requests the latest period whole while it fits one request, so it is replaced and corrections arrive", () => {
    expect(planWindows({ existing: [{ from: "2025-01-01", to: "2025-12-31" }, { from: "2026-01-01", to: "2026-11-03" }], through: "2026-11-05", dateOpened: null }))
      .toEqual([{ from: "2026-01-01", to: "2026-11-05" }]);
  });

  it("starts a new period the day after the latest once it would exceed 365 days", () => {
    expect(planWindows({ existing: [{ from: "2025-11-01", to: "2026-10-31" }], through: "2026-11-05", dateOpened: null }))
      .toEqual([{ from: "2026-11-01", to: "2026-11-05" }]);
  });

  it("has nothing to do when yesterday is already imported", () => {
    expect(planWindows({ existing: [{ from: "2026-01-01", to: "2026-11-05" }], through: "2026-11-05", dateOpened: null })).toEqual([]);
  });
});
