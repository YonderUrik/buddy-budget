import { describe, expect, it, vi } from "vitest";
import { classifyItem, detailIsin, parseShownNumber, positionMismatches, readTradeRepublicInvestments, type TradeRepublicTrade } from "./investments";

const ISIN = "IE00B4L5Y983";
// Timeline items and details shaped like Trade Republic's (German locale), as pytr reads them.
const item = (id: string, eventType: string, value: number | null, extra: Record<string, unknown> = {}) => ({
  id, timestamp: "2026-03-02T10:00:00.000+0000", eventType, title: "Core MSCI World", subtitle: "Kauforder", status: "EXECUTED",
  amount: value === null ? null : { value, currency: "EUR" }, action: { type: "timelineDetail", payload: id }, ...extra,
});
const detail = (rows: [string, string][], status = "executed") => ({
  id: "x",
  sections: [
    { type: "header", title: "Du hast 2 Aktien gekauft", action: { type: "instrumentDetail", payload: ISIN }, data: { icon: `logos/${ISIN}/v2`, status } },
    { type: "table", title: "Übersicht", data: [{ title: "Vermögenswert", detail: { text: "Core MSCI World USD (Acc)" } }, ...rows.map(([title, text]) => ({ title, detail: { text } }))] },
  ],
});
const reader = (pages: { transactions: unknown[]; activity?: unknown[] }, details: Record<string, unknown>, positions: unknown = { categories: [{ positions: [{ isin: ISIN, netSize: "3" }] }] }) => ({
  read: vi.fn(async (topic: string, params?: Record<string, string>) => {
    if (topic === "timelineTransactions") return { items: pages.transactions };
    if (topic === "timelineActivityLog") return { items: pages.activity ?? [] };
    if (topic === "compactPortfolioByType") return positions;
    return details[params!.id];
  }),
  close: vi.fn(),
});
const options = { securitiesAccountNumber: "0123456789" };

describe("Trade Republic investment history", () => {
  it("reads trades from both timelines, price from the booked total, and checks the positions", async () => {
    const api = reader(
      { transactions: [item("buy", "TRADING_TRADE_EXECUTED", -192.12), item("card", "CARD_TRANSACTION", -5)], activity: [item("plan", "TRADING_SAVINGSPLAN_EXECUTED", -100, { subtitle: "Sparplan ausgeführt" })] },
      { buy: detail([["Aktien", "2"], ["Gebühr", "1,00 €"], ["Gesamt", "192,12 €"]]), plan: detail([["Aktien", "1"], ["Gebühr", "Kostenlos"]]) },
    );
    const result = await readTradeRepublicInvestments(api, options);
    expect(result.trades.map(({ eventId, side, quantity, price, fees }) => ({ eventId, side, quantity, price: Number(price.toFixed(2)), fees }))).toEqual([
      { eventId: "buy", side: "acquisto", quantity: 2, price: 95.56, fees: 1 },
      { eventId: "plan", side: "acquisto", quantity: 1, price: 100, fees: 0 },
    ]);
    expect(api.read).toHaveBeenCalledWith("compactPortfolioByType", { secAccNo: "0123456789" });
    expect(positionMismatches(result.trades, result.positions!)).toBe(0);
  });
  it("ignores cancelled settlements, by item status, subtitle or detail header, instead of reading them as sales", async () => {
    const api = reader({ transactions: [
      item("buy", "TRADE_INVOICE", -100),
      item("storno", "TRADE_INVOICE", 100, { subtitle: "Kauf-Abrechnung storniert" }),
      item("canceled", "TRADE_INVOICE", 100, { status: "CANCELED" }),
      item("header", "TRADE_INVOICE", 100),
    ] }, { buy: detail([["Aktien", "1"]]), header: detail([["Aktien", "1"]], "canceled") });
    const result = await readTradeRepublicInvestments(api, options);
    expect(result.trades.map((trade) => trade.eventId)).toEqual(["buy"]);
  });
  it("keeps one copy of a legacy order listed twice within half a second", async () => {
    const legacy = (id: string, timestamp: string) => item(id, "TIMELINE_LEGACY_MIGRATED_EVENTS", -50, { subtitle: "Limit-Buy-Order", timestamp });
    const api = reader({ transactions: [legacy("old", "2021-05-03T09:00:00.100+0000")], activity: [legacy("new", "2021-05-03T09:00:00.400+0000")] }, { old: detail([["Aktien", "1"]]), new: detail([["Aktien", "1"]]) });
    expect((await readTradeRepublicInvestments(api, options)).trades.map((trade) => trade.eventId)).toEqual(["new"]);
  });
  it("records free shares and incoming transfers as adjustments, and skips rewards without a detail", async () => {
    const api = reader({ transactions: [
      item("saveback", "BENEFITS_SAVEBACK_EXECUTION", -15),
      item("transfer", "SSP_SECURITIES_TRANSFER_INCOMING", null),
      item("reward", "SAVEBACK_PAYOUT", 15, { action: null }),
    ] }, { saveback: detail([["Aktien", "0,15"]]), transfer: detail([["Aktien", "2"]]) });
    const result = await readTradeRepublicInvestments(api, options);
    expect(result.trades.map(({ eventId, side, quantity, grossAmount }) => ({ eventId, side, quantity, grossAmount }))).toEqual([
      { eventId: "saveback", side: "rettifica", quantity: 0.15, grossAmount: 15 },
      { eventId: "transfer", side: "rettifica", quantity: 2, grossAmount: 0 },
    ]);
  });
  it("takes a sale's side from Orderart and its price from Aktienkurs, as in a real small Verkaufsorder", async () => {
    // Real layout (staging, values replaced): the booked amount alone gave a non-positive price for this sale.
    const sale = detail([["Status", "Ausgeführt"], ["Orderart", "Verkauf"], ["Asset", "Aktie"], ["Rendite", "-12 %"], ["Verlust", "0,40 €"], ["Anteile", "0,012345"], ["Aktienkurs", "120,50 €"], ["Gebühr", "1,00 €"], ["Gesamt", "0,49 €"]]);
    const api = reader({ transactions: [item("buy", "TRADE_INVOICE", -150), item("sale", "TRADE_INVOICE", -0.49, { subtitle: "Verkaufsorder" })] }, { buy: detail([["Anteile", "1"]]), sale });
    const trades = (await readTradeRepublicInvestments(api, options)).trades;
    expect(trades.find((trade) => trade.eventId === "sale")).toMatchObject({ side: "vendita", quantity: 0.012345, price: 120.5, fees: 1 });
  });
  it("reads a redeemed stock perk's shares and price from the `Transaktion = shares × price` row", async () => {
    const perk = detail([["Kauf", "Aktien-Bonus"], ["Bonus", "15,00 €"], ["Transaktion", "0.123456 × 121,50 €"], ["Gebühr", "Kostenlos"], ["Gesamt", "15,00 €"]]);
    const api = reader({ transactions: [item("perk", "ACQUISITION_TRADE_PERK", 15, { subtitle: "Eingelöst" })] }, { perk }, { categories: [{ positions: [{ isin: ISIN, netSize: "0.123456" }] }] });
    const result = await readTradeRepublicInvestments(api, options);
    expect(result.trades).toMatchObject([{ side: "rettifica", quantity: 0.123456, grossAmount: 15 }]);
    expect(positionMismatches(result.trades, result.positions!)).toBe(0);
  });
  it("records an accepted share gift and redeemed free crypto as received shares, and ignores a declined gift", async () => {
    // Real layouts (staging capture, values replaced): the quantity is `Aktien` for the gift and `Betrag` for the crypto.
    const gift = detail([["Status", "Ausgeführt"], ["Orderart", "Kauf"], ["Aktien", "0.06597"], ["Aktienkurs", "454,05 €"], ["Aktien", "29,95 €"], ["Cash-Gutschrift", "0,05 €"], ["Summe", "30,00 €"]]);
    const crypto = detail([["Status", "Ausgeführt"], ["Orderart", "Kauf"], ["Betrag", "0.0037"], ["Kurs", "2.801,90 €"], ["Gesamt", "10,37 €"]]);
    const api = reader({ transactions: [], activity: [
      item("gift", "GIFTING_RECIPIENT_ACTIVITY", null, { subtitle: "Angenommen", status: null }),
      item("declined", "GIFTING_RECIPIENT_ACTIVITY", null, { subtitle: "Abgelehnt", status: null }),
      item("eth", "CRYPTO_PERK_REFUNDED", null, { subtitle: "Eingelöst", status: null }),
    ] }, { gift, crypto: undefined, eth: crypto }, { categories: [] });
    const result = await readTradeRepublicInvestments(api, options);
    expect(result.trades.map(({ eventId, side, quantity, grossAmount }) => ({ eventId, side, quantity, grossAmount }))).toEqual([
      { eventId: "gift", side: "rettifica", quantity: 0.06597, grossAmount: 30 },
      { eventId: "eth", side: "rettifica", quantity: 0.0037, grossAmount: 10.37 },
    ]);
    expect(api.read).not.toHaveBeenCalledWith("timelineDetailV2", { id: "declined" });
  });
  it("fails after the whole history when items cannot be mapped, instead of importing wrong holdings", async () => {
    const api = reader({ transactions: [item("ok", "TRADE_INVOICE", -10), item("nodetail", "TRADE_INVOICE", -10, { action: { type: "none" } }), item("split", "SSP_CORPORATE_ACTION_INVOICE_SHARES", null), item("noshares", "TRADE_INVOICE", -10)] },
      { ok: detail([["Aktien", "1"]]), noshares: detail([]) });
    await expect(readTradeRepublicInvestments(api, options)).rejects.toThrow("invalid-response");
    expect(api.read).not.toHaveBeenCalledWith("compactPortfolioByType", expect.anything());
  });
  it("imports without the quantity check when positions are refused or the account number is missing", async () => {
    const refused = reader({ transactions: [item("buy", "TRADE_INVOICE", -10)] }, { buy: detail([["Aktien", "1"]]) });
    refused.read.mockImplementation(async (topic: string) => {
      if (topic === "compactPortfolioByType") throw Object.assign(new Error("refused"), { codes: ["BAD_SUBSCRIPTION_TYPE"] });
      return topic === "timelineDetailV2" ? detail([["Aktien", "1"]]) : { items: topic === "timelineTransactions" ? [item("buy", "TRADE_INVOICE", -10)] : [] };
    });
    expect((await readTradeRepublicInvestments(refused, options)).positions).toBeNull();
    expect((await readTradeRepublicInvestments(reader({ transactions: [] }, {}), { securitiesAccountNumber: null })).positions).toBeNull();
  });
  it("classifies items like pytr and reads the ISIN from the instrument action or header icon", () => {
    expect(classifyItem({ eventType: "TRADING_TRADE_EXECUTED", subtitle: null, status: "EXECUTED" })).toBe("trade");
    expect(classifyItem({ eventType: "CARD_TRANSACTION", subtitle: null, status: "EXECUTED" })).toBeNull();
    expect(classifyItem({ eventType: "TIMELINE_LEGACY_MIGRATED_EVENTS", subtitle: "Verkaufsorder", status: null })).toBe("trade");
    expect(classifyItem({ eventType: "TIMELINE_LEGACY_MIGRATED_EVENTS", subtitle: "Zinsen", status: null })).toBeNull();
    expect(detailIsin({ sections: [{ type: "header", data: { icon: `logos/${ISIN}/v2` } }] })).toBe(ISIN);
    expect(detailIsin({ sections: [{ type: "header", data: { icon: "logos/referral/v2" } }] })).toBeNull();
  });
  it("parses numbers in the German locale first, as Trade Republic shows them", () => {
    expect(parseShownNumber("1.234,56 €")).toBe(1234.56);
    expect(parseShownNumber("0,123456")).toBe(0.123456);
    expect(parseShownNumber("1.000")).toBe(1000);
    expect(parseShownNumber("0.5")).toBe(0.5);
    expect(parseShownNumber("Kostenlos")).toBe(0);
    expect(parseShownNumber("—")).toBeNaN();
  });
  it("reports ISINs whose imported quantity differs from Trade Republic's positions", () => {
    const trade: TradeRepublicTrade = { eventId: "a", eventType: "TRADE_INVOICE", date: "2026-01-01", isin: ISIN, name: null, side: "acquisto", quantity: 2, price: 1, grossAmount: null, fees: 0, taxes: 0, subtitle: null };
    expect(positionMismatches([trade], new Map([[ISIN, 3]]))).toBe(1);
    expect(positionMismatches([trade, { ...trade, side: "rettifica", quantity: 1 }], new Map([[ISIN, 3]]))).toBe(0);
  });
});
