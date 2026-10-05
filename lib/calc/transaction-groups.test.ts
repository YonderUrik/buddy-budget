import { describe, expect, it } from "vitest";
import { effectiveSignedAmount, groupTransactionsByDay, relativeDayKind } from "./transaction-groups";

const tx = (id: string, date: string, amount: string, excludedAmount = "0") => ({ id, date, amount, excludedAmount });

describe("groupTransactionsByDay", () => {
  it("raggruppa per giorno, dal più recente, sommando gli importi effettivi", () => {
    const groups = groupTransactionsByDay([
      tx("a", "2026-10-02", "-10"),
      tx("b", "2026-10-05", "-95.36", "-47.68"),
      tx("c", "2026-10-05", "-3.2"),
      tx("d", "2026-10-02", "2480"),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-10-05", "2026-10-02"]);
    expect(groups[0].net).toBeCloseTo(-50.88);
    expect(groups[1].net).toBe(2470);
    expect(groups[0].transactions.map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("restituisce un elenco vuoto senza transazioni", () => {
    expect(groupTransactionsByDay([])).toEqual([]);
  });
});

describe("effectiveSignedAmount", () => {
  it("toglie la quota esclusa mantenendo il segno", () => {
    expect(effectiveSignedAmount({ amount: "-100", excludedAmount: "-40" })).toBe(-60);
    expect(effectiveSignedAmount({ amount: "50", excludedAmount: "0" })).toBe(50);
  });
});

describe("relativeDayKind", () => {
  const today = new Date(2026, 9, 5);
  it("riconosce oggi e ieri", () => {
    expect(relativeDayKind("2026-10-05", today)).toBe("oggi");
    expect(relativeDayKind("2026-10-04", today)).toBe("ieri");
    expect(relativeDayKind("2026-10-03", today)).toBeNull();
  });
});
