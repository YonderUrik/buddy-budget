import { describe, expect, it } from "vitest";
import { buildAccountBalanceSeries } from "./account-series";
import { dayLabel, groupByDay } from "./day-groups";
import { clampOwnShare, excludedFromOwnShare, matchPreset, ownShareForPreset } from "./split";
import type { Account } from "@/lib/db/schema/accounts";
import type { Transaction } from "@/lib/db/schema/transactions";

const tx = (over: Partial<Transaction>): Transaction =>
  ({ id: "t", accountId: "a1", amount: "-10.00", excludedAmount: "0", date: "2026-10-07", description: "x", ...over }) as Transaction;
const today = new Date(2026, 9, 7);

describe("groupByDay", () => {
  it("raggruppa per giorno dal più recente con etichette e totali effettivi", () => {
    const groups = groupByDay(
      [tx({ id: "1", date: "2026-10-06", amount: "-20.00", excludedAmount: "-10.00" }), tx({ id: "2", date: "2026-10-07", amount: "-5.00" }), tx({ id: "3", date: "2026-10-06", amount: "100.00" })],
      today
    );
    expect(groups.map((g) => g.date)).toEqual(["2026-10-07", "2026-10-06"]);
    expect(groups.map((g) => g.label)).toEqual(["Oggi", "Ieri"]);
    expect(groups[1].total).toBe(90);
  });
  it("mostra l'anno solo per date di anni diversi", () => {
    expect(dayLabel("2026-10-05", today)).toMatch(/5 ottobre$/);
    expect(dayLabel("2025-10-05", today)).toMatch(/2025$/);
  });
});

describe("buildAccountBalanceSeries", () => {
  const auto = { id: "a1", source: "auto", balance: "100.00" } as Account;
  it("ricostruisce il saldo all'indietro dai movimenti", () => {
    const series = buildAccountBalanceSeries(auto, [tx({ date: "2026-10-07", amount: "-30.00" }), tx({ date: "2026-10-06", amount: "50.00" })], new Date(2026, 9, 5), today);
    expect(series[series.length - 1]).toEqual({ date: "2026-10-07", value: 100 });
    expect(series.find((p) => p.date === "2026-10-06")?.value).toBe(130);
    expect(series.find((p) => p.date === "2026-10-05")?.value).toBe(80);
  });
  it("tiene piatto un conto manuale", () => {
    const manual = { id: "a1", source: "manuale", balance: "40.00" } as Account;
    expect(new Set(buildAccountBalanceSeries(manual, [tx({})], new Date(2026, 9, 1), today).map((p) => p.value))).toEqual(new Set([40]));
  });
});

describe("split", () => {
  it("calcola quota tua ed esclusa", () => {
    expect(ownShareForPreset(84, 2)).toBe(42);
    expect(excludedFromOwnShare(84, 42)).toBe(42);
    expect(excludedFromOwnShare(10, 12)).toBe(0);
    expect(clampOwnShare(Number.NaN, 10)).toBe(10);
    expect(clampOwnShare(-3, 10)).toBe(0);
  });
  it("riconosce il preset", () => {
    expect(matchPreset(90, 30)?.key).toBe("terzo");
    expect(matchPreset(90, 31)).toBeNull();
  });
});

import { buildCumulativeSpend } from "./spend-curve";
describe("buildCumulativeSpend", () => {
  it("cumula le spese effettive giorno per giorno e si ferma a oggi", () => {
    const points = buildCumulativeSpend(
      [tx({ date: "2026-10-02", amount: "-20.00", excludedAmount: "-5.00" }), tx({ date: "2026-10-03", amount: "-10.00" }), tx({ date: "2026-10-03", amount: "100.00" })],
      { from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) },
      new Date(2026, 9, 4)
    );
    expect(points.map((p) => p.value)).toEqual([0, 15, 25, 25]);
  });
});
