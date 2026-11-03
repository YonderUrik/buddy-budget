import { describe, expect, it } from "vitest";
import { addExcludedQuantities, applyExclusions, quantityDelta, type ExcludedOperation } from "./exclusions";

const op = (type: "acquisto" | "vendita", date: string, quantity: number, price = 10) => ({ instrumentId: "a", type, date, quantity, price, grossAmount: null });
const exclusion = (id: string, o: ReturnType<typeof op>): ExcludedOperation => ({ id, ...o });

describe("deleted imported operations", () => {
  it("leaves out each deleted operation once, like duplicates", () => {
    const buy = op("acquisto", "2024-01-02", 5);
    const result = applyExclusions([buy, buy, op("acquisto", "2024-02-02", 1)], [exclusion("x", buy)]);
    expect(result.kept).toHaveLength(2);
    expect(result.matched.map((e) => e.id)).toEqual(["x"]);
    expect(result.stale).toEqual([]);
  });

  it("forgets a deletion the broker no longer reports", () => {
    const result = applyExclusions([op("acquisto", "2024-01-02", 5)], [exclusion("x", op("acquisto", "2024-01-02", 6))]);
    expect(result.kept).toHaveLength(1);
    expect(result.stale.map((e) => e.id)).toEqual(["x"]);
  });

  it("gives way to the broker's history when leaving the operation out would oversell", () => {
    const buy = op("acquisto", "2024-01-02", 5);
    const result = applyExclusions([buy, op("vendita", "2024-03-01", 5)], [exclusion("x", buy)]);
    expect(result.kept).toHaveLength(2);
    expect(result.stale.map((e) => e.id)).toEqual(["x"]);
  });

  it("counts deleted quantities for reconciliation", () => {
    expect(quantityDelta(op("vendita", "2024-01-01", 2))).toBe(-2);
    const totals = addExcludedQuantities(new Map([["a", 1]]), [exclusion("x", op("acquisto", "2024-01-02", 5))]);
    expect(totals.get("a")).toBe(6);
  });
});
