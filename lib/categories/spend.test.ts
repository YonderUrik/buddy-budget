import { describe, expect, it } from "vitest";
import { sumByCategory, sumByGroup } from "./spend";

describe("sumByCategory", () => {
  it("somma in valore assoluto al netto della quota esclusa e ignora le senza categoria", () => {
    const totals = sumByCategory([
      { categoryId: "a", amount: "-50.00", excludedAmount: "0" },
      { categoryId: "a", amount: "-30.00", excludedAmount: "-10.00" },
      { categoryId: "b", amount: "1200.00", excludedAmount: "0" },
      { categoryId: null, amount: "-5.00", excludedAmount: "0" },
    ]);
    expect(totals).toEqual({ a: 70, b: 1200 });
  });
});

describe("sumByGroup", () => {
  it("raggruppa per gruppo, tiene a parte la fallback ed esclude le entrate", () => {
    const totals = sumByGroup(
      [
        { id: "a", type: "dovuta", isFallback: false },
        { id: "b", type: "dovuta", isFallback: false },
        { id: "c", type: "voluta", isFallback: false },
        { id: "f", type: "voluta", isFallback: true },
        { id: "e", type: "entrata", isFallback: false },
      ],
      { a: 10, b: 5, c: 7, f: 3, e: 100 }
    );
    expect(totals).toEqual({ dovuta: 15, voluta: 7, daCategorizzare: 3 });
  });
});
