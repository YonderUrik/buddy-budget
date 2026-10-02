import { describe, expect, it } from "vitest";
import type { PensionFundData } from "@/lib/pension/types";
import { buildPensionHistoryRows, pensionTotalOn } from "./pension-history";

const fund = (id: string, snapshots: [string, number][]): PensionFundData => ({
  id,
  name: id,
  adhesionDate: "2022-01-01",
  snapshots: snapshots.map(([date, value], i) => ({ id: `${id}${i}`, date, netContributions: value, value })),
});

describe("pensionTotalOn", () => {
  it("somma l'ultima fotografia nota di ogni fondo", () => {
    const funds = [fund("a", [["2026-01-01", 100], ["2026-03-01", 150]]), fund("b", [["2026-02-01", 40]])];
    expect(pensionTotalOn(funds, "2026-01-15")).toBe(100);
    expect(pensionTotalOn(funds, "2026-02-15")).toBe(140);
    expect(pensionTotalOn(funds, "2026-03-15")).toBe(190);
    expect(pensionTotalOn(funds, "2025-12-31")).toBe(0);
  });
});

describe("buildPensionHistoryRows", () => {
  it("è vuoto senza fotografie", () => {
    expect(buildPensionHistoryRows([fund("a", [])], "2026-01-10")).toEqual([]);
  });

  it("produce una riga al giorno dalla prima fotografia a ieri, a gradini", () => {
    const rows = buildPensionHistoryRows([fund("a", [["2026-01-01", 100], ["2026-01-03", 130]])], "2026-01-05");
    expect(rows.map((r) => [r.date, r.amount])).toEqual([
      ["2026-01-01", "100.00"],
      ["2026-01-02", "100.00"],
      ["2026-01-03", "130.00"],
      ["2026-01-04", "130.00"],
    ]);
    expect(rows[0].assetClass).toBe("previdenza");
  });

  it("parte dal limite richiesto se è successivo alla prima fotografia", () => {
    const rows = buildPensionHistoryRows([fund("a", [["2026-01-01", 100]])], "2026-01-05", "2026-01-04");
    expect(rows.map((r) => r.date)).toEqual(["2026-01-04"]);
  });
});
