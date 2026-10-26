import { describe, expect, it, vi } from "vitest";
import { parseShownNumber, positionMismatches, readTradeRepublicInvestments } from "./investments";

// Shaped like TR's timelineDetailV2: a header with the instrument action, and tables of `{ title, detail: { text } }`.
const detail = (rows: [string, string][], isin = "IE00B4L5Y983") => ({
  id: "x",
  sections: [
    { type: "header", title: "You bought 2 shares", action: { type: "instrumentDetail", payload: isin }, data: { icon: `logos/${isin}/v2` } },
    { type: "table", title: "Overview", data: [{ title: "Asset", detail: { text: "Core MSCI World USD (Acc)", type: "text" } }] },
    { type: "table", title: "Transaction", data: rows.map(([title, text]) => ({ title, detail: { text, type: "text" } })) },
  ],
});
const reader = (details: Record<string, unknown>, positions: unknown = { positions: [{ instrumentId: "IE00B4L5Y983", netSize: "3" }] }) => ({
  read: vi.fn(async (topic: string, params?: Record<string, string>) => topic === "compactPortfolio" ? positions : details[params!.id]),
  close: vi.fn(),
});
const buy = { id: "buy", eventType: "TRADING_TRADE_EXECUTED", date: "2026-03-02", amount: -192.12 };

describe("Trade Republic investment details", () => {
  it("reads shares, price, fees and ISIN from the detail, and the positions last", async () => {
    const api = reader({
      buy: detail([["Shares", "2"], ["Share price", "€95.56"], ["Fee", "€1.00"], ["Total", "€192.12"]]),
      plan: detail([["Shares", "1"], ["Share price", "€100.00"], ["Fee", "Free"]]),
    });
    const result = await readTradeRepublicInvestments(api, [buy, { id: "plan", eventType: "TRADING_SAVINGSPLAN_EXECUTED", date: "2026-04-01", amount: -100 }]);
    expect(result.trades).toEqual([
      { eventId: "buy", eventType: "TRADING_TRADE_EXECUTED", date: "2026-03-02", isin: "IE00B4L5Y983", name: "Core MSCI World USD (Acc)", side: "acquisto", quantity: 2, price: 95.56, fees: 1, taxes: 0 },
      { eventId: "plan", eventType: "TRADING_SAVINGSPLAN_EXECUTED", date: "2026-04-01", isin: "IE00B4L5Y983", name: "Core MSCI World USD (Acc)", side: "acquisto", quantity: 1, price: 100, fees: 0, taxes: 0 },
    ]);
    expect(api.read.mock.calls.at(-1)).toEqual(["compactPortfolio"]);
    expect(positionMismatches(result.trades, result.positions!)).toBe(0);
  });
  it("treats a positive amount as a sale and Trade Republic rewards as free buys", async () => {
    const api = reader({ sell: detail([["Shares", "1"], ["Share price", "€110.00"], ["Fee", "€1.00"], ["Tax", "€2.50"]]), gift: detail([["Shares", "0.05"], ["Share price", "€100.00"]]) });
    const result = await readTradeRepublicInvestments(api, [{ id: "sell", eventType: "TRADING_TRADE_EXECUTED", date: "2026-05-01", amount: 106.5 }, { id: "gift", eventType: "SAVEBACK_PAYOUT", date: "2026-05-02", amount: 5 }]);
    expect(result.trades.map(({ side, fees, taxes }) => ({ side, fees, taxes }))).toEqual([{ side: "vendita", fees: 1, taxes: 2.5 }, { side: "acquisto", fees: 0, taxes: 0 }]);
  });
  it("skips a reward whose detail names no instrument, leaving the positions check to catch a missing share", async () => {
    const api = reader({ buy: detail([["Shares", "3"], ["Share price", "€64.00"], ["Fee", "€0.00"]]), reward: { id: "r", sections: [{ title: " ", type: "header", action: null, data: { icon: "logos/referral/v2", status: "executed" } }] } });
    const result = await readTradeRepublicInvestments(api, [{ ...buy, amount: -192 }, { id: "reward", eventType: "REFERRAL_FIRST_TRADE_EXECUTED_INVITER", date: "2026-03-03", amount: 15 }]);
    expect(result.trades.map((trade) => trade.eventId)).toEqual(["buy"]);
  });
  it("fails after reading every event when a detail cannot be mapped, instead of importing a wrong trade", async () => {
    const api = reader({ buy: detail([["Shares", "5"], ["Share price", "€95.56"]]), other: { sections: [] } });
    await expect(readTradeRepublicInvestments(api, [buy, { ...buy, id: "other" }, { ...buy, id: "split", eventType: "SSP_CORPORATE_ACTION_SECURITIES" }])).rejects.toThrow("invalid-response");
    expect(api.read).toHaveBeenCalledTimes(2);
  });
  it("keeps the import going without a quantity check when positions cannot be read", async () => {
    const api = reader({ buy: detail([["Shares", "2"], ["Share price", "€95.56"], ["Fee", "€1.00"]]) }, { unexpected: true });
    expect((await readTradeRepublicInvestments(api, [buy])).positions).toBeNull();
  });
  it("parses the numbers Trade Republic shows in the English locale", () => {
    expect(parseShownNumber("€1,234.56")).toBe(1234.56);
    expect(parseShownNumber("0.123456")).toBe(0.123456);
    expect(parseShownNumber("0,5")).toBe(0.5);
    expect(parseShownNumber("1,000")).toBe(1000);
    expect(parseShownNumber("Free")).toBe(0);
    expect(parseShownNumber("—")).toBeNaN();
  });
  it("reports ISINs whose imported quantity differs from Trade Republic's positions", () => {
    const trade = { eventId: "a", eventType: "TRADING_TRADE_EXECUTED", date: "2026-01-01", isin: "IE00B4L5Y983", name: null, side: "acquisto" as const, quantity: 2, price: 1, fees: 0, taxes: 0 };
    expect(positionMismatches([trade], new Map([["IE00B4L5Y983", 3]]))).toBe(1);
    expect(positionMismatches([trade], new Map([["IE00B4L5Y983", 2], ["US0378331005", 1]]))).toBe(1);
  });
});
