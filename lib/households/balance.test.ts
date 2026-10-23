import { describe, expect, it } from "vitest";
import { computeBalances, expenseEffect, participantsOf, settleUp } from "./balance";

const all = (payerId: string, amount: number) => ({ payerId, amount, forIds: null });

describe("computeBalances", () => {
  it("splits a couple's expenses in half", () => {
    const balances = computeBalances(["d", "g"], [all("d", 412), all("g", 283.6)], []);
    expect(balances.get("d")).toBe(64.2);
    expect(balances.get("g")).toBe(-64.2);
  });

  it("splits among three and settles to zero", () => {
    const balances = computeBalances(["d", "m", "s"], [all("d", 474.5), all("m", 372), all("s", 389.5)], []);
    expect(balances.get("d")).toBe(62.5);
    expect(settleUp(balances)).toEqual([
      { from: "m", to: "d", amount: 40 },
      { from: "s", to: "d", amount: 22.5 },
    ]);
  });

  it("applies settlements and ignores people who left", () => {
    const balances = computeBalances(["d", "g"], [all("d", 100), all("x", 50)], [{ from: "g", to: "d", amount: 50 }]);
    expect(balances.get("d")).toBe(0);
    expect(settleUp(balances)).toEqual([]);
  });

  it("does nothing for a group of one", () => {
    expect(computeBalances(["d"], [all("d", 10)], []).get("d")).toBe(0);
  });

  it("charges the whole expense to the person it was paid for", () => {
    const balances = computeBalances(["g", "m"], [{ payerId: "g", amount: 31.3, forIds: ["m"] }], []);
    expect(balances.get("g")).toBe(31.3);
    expect(balances.get("m")).toBe(-31.3);
  });

  it("splits only among the people chosen", () => {
    const balances = computeBalances(["g", "s", "l"], [{ payerId: "s", amount: 90, forIds: ["s", "l"] }], []);
    expect(balances.get("s")).toBe(45);
    expect(balances.get("l")).toBe(-45);
    expect(balances.get("g")).toBe(0);
  });

  it("falls back to everyone when every person it was for has left", () => {
    expect(participantsOf({ forIds: ["x"] }, ["a", "b"])).toEqual(["a", "b"]);
    expect(participantsOf({ forIds: ["x", "b"] }, ["a", "b"])).toEqual(["b"]);
  });
});

describe("expenseEffect", () => {
  it("says what one expense means for each member", () => {
    const expense = { payerId: "g", amount: 60, forIds: ["g", "m", "l"] };
    expect(expenseEffect(expense, ["g", "m", "l", "s"], "g")).toBe(40);
    expect(expenseEffect(expense, ["g", "m", "l", "s"], "m")).toBe(-20);
    expect(expenseEffect(expense, ["g", "m", "l", "s"], "s")).toBe(0);
  });
});
