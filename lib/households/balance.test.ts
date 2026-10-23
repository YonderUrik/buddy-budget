import { describe, expect, it } from "vitest";
import { computeBalances, settleUp } from "./balance";

describe("computeBalances", () => {
  it("splits a couple's expenses in half", () => {
    const balances = computeBalances(["d", "g"], [{ payerId: "d", amount: 412 }, { payerId: "g", amount: 283.6 }], []);
    expect(balances.get("d")).toBe(64.2);
    expect(balances.get("g")).toBe(-64.2);
  });

  it("splits among three and settles to zero", () => {
    const balances = computeBalances(
      ["d", "m", "s"],
      [{ payerId: "d", amount: 474.5 }, { payerId: "m", amount: 372 }, { payerId: "s", amount: 389.5 }],
      []
    );
    expect(balances.get("d")).toBe(62.5);
    expect(settleUp(balances)).toEqual([
      { fromUserId: "m", toUserId: "d", amount: 40 },
      { fromUserId: "s", toUserId: "d", amount: 22.5 },
    ]);
  });

  it("applies settlements and ignores people who left", () => {
    const balances = computeBalances(["d", "g"], [{ payerId: "d", amount: 100 }, { payerId: "x", amount: 50 }], [{ fromUserId: "g", toUserId: "d", amount: 50 }]);
    expect(balances.get("d")).toBe(0);
    expect(settleUp(balances)).toEqual([]);
  });

  it("does nothing for a group of one", () => {
    expect(computeBalances(["d"], [{ payerId: "d", amount: 10 }], []).get("d")).toBe(0);
  });
});
