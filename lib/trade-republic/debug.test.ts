import { afterEach, describe, expect, it, vi } from "vitest";
import { describeShape, maskPattern, tradeRepublicDebugEnabled } from "./debug";
import { readTradeRepublicCash } from "./data";

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
  it("on staging, reads the whole timeline before failing on the first problem", async () => {
    vi.stubEnv("APP_URL", "https://staging.buddybudget.io");
    const item = (id: string, eventType: string) => ({ id, timestamp: "2026-10-01T10:00:00.000+0000", title: "Synthetic", eventType, status: "EXECUTED", amount: { value: -1, currency: "EUR" } });
    const pages = [{ items: [item("a", "NEW_TYPE"), { id: "b" }], cursors: { after: "next" } }, { items: [item("c", "CARD_TRANSACTION")] }];
    const read = vi.fn().mockResolvedValueOnce([{ currencyId: "EUR", amount: 1 }]).mockImplementation(async () => pages.shift());
    await expect(readTradeRepublicCash({ read, close: vi.fn() }, "2026-10-25")).rejects.toThrow("unsupported-event");
    expect(read).toHaveBeenCalledTimes(3);
  });
});
