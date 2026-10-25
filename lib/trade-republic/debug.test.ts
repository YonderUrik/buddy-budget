import { afterEach, describe, expect, it, vi } from "vitest";
import { describeShape, maskPattern, tradeRepublicDebugEnabled } from "./debug";

describe("Trade Republic staging diagnostics", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("is on only for the staging host", () => {
    vi.stubEnv("APP_URL", "https://staging.buddybudget.io");
    expect(tradeRepublicDebugEnabled()).toBe(true);
    for (const url of ["https://app.buddybudget.io", "http://localhost:3000", ""]) {
      vi.stubEnv("APP_URL", url);
      expect(tradeRepublicDebugEnabled()).toBe(false);
    }
  });
  it("keeps structure and formats but drops values", () => {
    expect(maskPattern("2024-05-22T14:19:42.016+0000")).toBe("9999-99-99T99:99:99.999+9999");
    expect(describeShape({ title: "Merchant", amount: { value: -12.5 }, items: [{ id: "x" }] })).toEqual({ title: "string(8)", amount: { value: "number" }, items: ["array(1)", { id: "string(1)" }] });
  });
});
