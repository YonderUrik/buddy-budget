import { describe, expect, it } from "vitest";
import { chartRefreshState, isRefreshSettled } from "./refresh-status";

describe("chartRefreshState", () => {
  it("says importing while a file import or sync runs, whatever the data", () => {
    expect(chartRefreshState({ importing: true, pendingSince: null, dataUpdatedAt: 5, isFetching: false })).toBe("importing");
  });

  it("says updating after the import ends until data newer than its end arrives", () => {
    expect(chartRefreshState({ importing: false, pendingSince: 100, dataUpdatedAt: 50, isFetching: false })).toBe("updating");
    expect(chartRefreshState({ importing: false, pendingSince: 100, dataUpdatedAt: 50, isFetching: true })).toBe("updating");
    expect(chartRefreshState({ importing: false, pendingSince: 100, dataUpdatedAt: 120, isFetching: true })).toBe("updating");
    expect(chartRefreshState({ importing: false, pendingSince: 100, dataUpdatedAt: 120, isFetching: false })).toBeNull();
  });

  it("stays quiet on ordinary refetches with nothing imported", () => {
    expect(chartRefreshState({ importing: false, pendingSince: null, dataUpdatedAt: 50, isFetching: true })).toBeNull();
  });
});

describe("isRefreshSettled", () => {
  it("is true only once fresh data has landed", () => {
    expect(isRefreshSettled({ pendingSince: 100, dataUpdatedAt: 120, isFetching: false })).toBe(true);
    expect(isRefreshSettled({ pendingSince: 100, dataUpdatedAt: 120, isFetching: true })).toBe(false);
    expect(isRefreshSettled({ pendingSince: null, dataUpdatedAt: 120, isFetching: false })).toBe(false);
  });
});
