import { describe, expect, it } from "vitest";
import { buildStatementBalanceSeries } from "./account-series";

describe("buildStatementBalanceSeries", () => {
  it("follows the rebuilt balances, carries them over missing days and ends on today's balance", () => {
    const history = [{ date: "2026-09-10", value: 2400 }, { date: "2026-09-12", value: -13000 }];
    const series = buildStatementBalanceSeries(history, -13050.4, new Date(2026, 8, 9), new Date(2026, 8, 13));
    expect(series).toEqual([
      { date: "2026-09-09", value: 0 },
      { date: "2026-09-10", value: 2400 },
      { date: "2026-09-11", value: 2400 },
      { date: "2026-09-12", value: -13000 },
      { date: "2026-09-13", value: -13050.4 },
    ]);
  });
});
