import { describe, expect, it, vi } from "vitest";
import { readTradeRepublicCash } from "./data";
const event = (id: string, eventType = "CARD_TRANSACTION", value = -12.34) => ({ id, timestamp: "2026-10-01T10:00:00Z", title: "Synthetic merchant", eventType, amount: { value, currency: "EUR" } });
const reader = (...pages: unknown[]) => ({ read: vi.fn().mockResolvedValueOnce([{ currencyId: "EUR", amount: "123.45" }]).mockImplementation(async () => pages.shift()), close: vi.fn() });
describe("Trade Republic direct cash reader", () => {
  it("paginates on one reader, deduplicates overlaps, and excludes trades from spending", async () => {
    const api = reader({ items: [event("one"), event("trade", "TRADING_TRADE_EXECUTED", -200)], cursors: { after: "next" } }, { items: [event("one"), event("two", "CARD_REFUND", 4.56)] });
    const progress = vi.fn();
    const result = await readTradeRepublicCash(api, "2026-10-25", progress);
    expect(result).toEqual({ balance: "123.45", investmentEvents: 1, unrecognized: 0, reconciled: false, movements: [{ id: "one", date: "2026-10-01", amount: "-12.34", description: "Synthetic merchant" }, { id: "two", date: "2026-10-01", amount: "4.56", description: "Synthetic merchant" }] });
    expect(api.read.mock.calls).toEqual([["cash"], ["timelineTransactions", undefined], ["timelineTransactions", { after: "next" }]]);
    expect(progress).toHaveBeenLastCalledWith(3);
  });
  it("accepts Trade Republic's colon-less offsets and skips movements that were never booked", async () => {
    const booked = { ...event("booked"), timestamp: "2026-10-01T10:00:00.016+0000" };
    const cancelled = { ...event("cancelled"), status: "CANCELED" };
    const live = { ...booked, cashAccountNumber: null, status: "EXECUTED", deleted: false };
    const result = await readTradeRepublicCash(reader({ items: [live, cancelled, { ...event("pending"), status: "PENDING" }, { ...event("gone"), deleted: true }] }), "2026-10-25");
    expect(result.movements).toEqual([{ id: "booked", date: "2026-10-01", amount: "-12.34", description: "Synthetic merchant" }]);
  });
  it("classifies the event types seen on a real account", async () => {
    const items = [event("atm", "CARD_ATM_WITHDRAWAL"), event("aft", "CARD_AFT"), event("topup", "PAYMENT_INBOUND_CREDIT_CARD", 50), event("bollo", "STAMP_DUTY_TAX_PAID", -2), event("gift", "GIFTER_TRANSACTION", -25), event("verify", "CARD_VERIFICATION", 0), event("order", "ORDER_EXECUTED", -100), event("referral", "REFERRAL_FIRST_TRADE_EXECUTED_INVITER", 15)];
    const result = await readTradeRepublicCash(reader({ items }), "2026-10-25");
    expect(result.movements.map(movement => movement.id)).toEqual(["atm", "aft", "topup", "bollo", "gift", "referral"]);
    expect(result.investmentEvents).toBe(1);
  });
  it("reads the whole timeline before failing, so one failure reports every malformed item", async () => {
    const pages = [{ items: [{ id: "broken" }, event("a")], cursors: { after: "next" } }, { items: [{ ...event("b"), amount: { value: -1, currency: "USD" } }] }];
    const api = reader(...pages);
    await expect(readTradeRepublicCash(api, "2026-10-25")).rejects.toThrow("invalid-response");
    expect(api.read).toHaveBeenCalledTimes(3);
  });
  it("reports whether the timeline adds up to the balance", async () => {
    expect((await readTradeRepublicCash(reader({ items: [event("one", "CARD_REFUND", 123.45)] }), "2026-10-25")).reconciled).toBe(true);
    expect((await readTradeRepublicCash(reader({ items: [event("one")] }), "2026-10-25")).reconciled).toBe(false);
  });
  it("imports dividend cash without treating securities purchases as expenses", async () => {
    const result = await readTradeRepublicCash(reader({ items: [event("dividend", "SSP_CORPORATE_ACTION_CASH", 2)] }), "2026-10-25");
    expect(result.movements[0].amount).toBe("2.00");
  });
  it("skips and counts unknown event types and statuses instead of guessing, and refuses repeated cursors", async () => {
    const result = await readTradeRepublicCash(reader({ items: [event("known"), event("unknown", "NEW_MONETARY_EVENT"), { ...event("odd"), status: "SOMETHING_NEW" }] }), "2026-10-25");
    expect(result.movements.map(movement => movement.id)).toEqual(["known"]);
    expect(result.unrecognized).toBe(2);
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
