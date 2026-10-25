import { describe, expect, it, vi } from "vitest";
import { readTradeRepublicCash } from "./data";
const event = (id: string, eventType = "CARD_TRANSACTION", value = -12.34) => ({ id, timestamp: "2026-10-01T10:00:00Z", title: "Synthetic merchant", eventType, amount: { value, currency: "EUR" } });
const reader = (...pages: unknown[]) => ({ read: vi.fn().mockResolvedValueOnce([{ currencyId: "EUR", amount: "123.45" }]).mockImplementation(async () => pages.shift()), close: vi.fn() });
describe("Trade Republic direct cash reader", () => {
  it("paginates on one reader, deduplicates overlaps, and excludes trades from spending", async () => {
    const api = reader({ items: [event("one"), event("trade", "TRADING_TRADE_EXECUTED", -200)], cursors: { after: "next" } }, { items: [event("one"), event("two", "CARD_REFUND", 4.56)] });
    const progress = vi.fn();
    const result = await readTradeRepublicCash(api, "2026-10-25", progress);
    expect(result).toEqual({ balance: "123.45", investmentEvents: 1, movements: [{ id: "one", date: "2026-10-01", amount: "-12.34", description: "Synthetic merchant" }, { id: "two", date: "2026-10-01", amount: "4.56", description: "Synthetic merchant" }] });
    expect(api.read.mock.calls).toEqual([["cash"], ["timelineTransactions", undefined], ["timelineTransactions", "next"]]);
    expect(progress).toHaveBeenLastCalledWith(3);
  });
  it("accepts Trade Republic's colon-less offsets and skips movements that were never booked", async () => {
    const booked = { ...event("booked"), timestamp: "2026-10-01T10:00:00.016+0000" };
    const cancelled = { ...event("cancelled"), status: "CANCELED" };
    const result = await readTradeRepublicCash(reader({ items: [booked, cancelled, { ...event("pending"), status: "PENDING" }] }), "2026-10-25");
    expect(result.movements).toEqual([{ id: "booked", date: "2026-10-01", amount: "-12.34", description: "Synthetic merchant" }]);
    await expect(readTradeRepublicCash(reader({ items: [{ ...event("odd"), status: "SOMETHING_NEW" }] }), "2026-10-25")).rejects.toThrow("invalid-response");
  });
  it("imports dividend cash without treating securities purchases as expenses", async () => {
    const result = await readTradeRepublicCash(reader({ items: [event("dividend", "SSP_CORPORATE_ACTION_CASH", 2)] }), "2026-10-25");
    expect(result.movements[0].amount).toBe("2.00");
  });
  it("refuses unknown monetary events and repeated cursors", async () => {
    await expect(readTradeRepublicCash(reader({ items: [event("unknown", "NEW_MONETARY_EVENT")] }), "2026-10-25")).rejects.toThrow("unsupported-event");
    await expect(readTradeRepublicCash(reader({ items: [], cursors: { after: "same" } }, { items: [], cursors: { after: "same" } }), "2026-10-25")).rejects.toThrow("invalid-response");
  });
  it("refuses inconsistent duplicate IDs, foreign currency, and future booking dates", async () => {
    await expect(readTradeRepublicCash(reader({ items: [event("one"), event("one", "CARD_TRANSACTION", -25)] }), "2026-10-25")).rejects.toThrow("invalid-response");
    const foreign = event("foreign"); foreign.amount.currency = "USD";
    await expect(readTradeRepublicCash(reader({ items: [foreign] }), "2026-10-25")).rejects.toThrow("invalid-response");
    await expect(readTradeRepublicCash(reader({ items: [event("future")] }), "2026-09-01")).rejects.toThrow("invalid-response");
  });
  it("does not treat a malformed or multi-currency balance as zero", async () => {
    const api = { read: vi.fn().mockResolvedValue([{ currencyId: "USD", amount: 12 }]), close: vi.fn() };
    await expect(readTradeRepublicCash(api, "2026-10-25")).rejects.toThrow("invalid-response");
  });
});
