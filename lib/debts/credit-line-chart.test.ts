import { describe, expect, it } from "vitest";
import { buildBalanceChartData, CHART_HEADROOM } from "./credit-line-chart";

describe("buildBalanceChartData", () => {
  it("chiude la serie a oggi con l'ultimo saldo e tiene il fido dentro l'asse", () => {
    const data = buildBalanceChartData(
      [
        { date: "2026-01-01", balance: 0 },
        { date: "2026-01-11", balance: 3000 },
      ],
      50000,
      "2026-02-01"
    );
    expect(data.points).toHaveLength(3);
    expect(data.points[2]).toEqual({ time: Date.parse("2026-02-01T00:00:00Z"), balance: 3000 });
    expect(data.yMax).toBe(50000 * CHART_HEADROOM);
  });

  it("non aggiunge un punto se l'ultimo è già oggi, e sale oltre il fido se l'utilizzo lo supera", () => {
    const data = buildBalanceChartData([{ date: "2026-01-01", balance: 60000 }], 50000, "2026-01-01");
    expect(data.points).toHaveLength(1);
    expect(data.yMax).toBe(60000 * CHART_HEADROOM);
  });
});
