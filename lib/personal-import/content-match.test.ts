import { describe, expect, it } from "vitest";
import { existingCashKey, existingTradeKey, presentByContent, type MatchRecord } from "./content-match";
import { classifyFile, dateOrderHint } from "./hints";

const cash = (key: string, amount: number, description = "Bar Roma", date = "2026-10-02"): MatchRecord => ({ key, rate: 1, outcome: { row: 0, kind: "cash", date, currency: "EUR", amount, description, transfer: false } });
const stored = (amount: string, description = "Bar Roma", date = "2026-10-02") => existingCashKey({ date, amount, description });

describe("exact match on content", () => {
  it("skips a movement already in the account after a layout change, ignoring case and spaces", () => {
    const row = cash("new:1", -1.5, "BAR  roma ");
    expect(presentByContent([row], [row], [stored("-1.50")])).toEqual(new Set(["new:1"]));
  });

  it("never matches a different amount, date or description", () => {
    const rows = [cash("a", -1.51), cash("b", -1.5, "Bar Milano"), cash("c", -1.5, "Bar Roma", "2026-10-03")];
    expect(presentByContent(rows, rows, [stored("-1.50")]).size).toBe(0);
  });

  it("counts occurrences: two identical coffees with one stored keep one new", () => {
    const rows = [cash("a", -1.5), cash("b", -1.5)];
    expect(presentByContent(rows, rows, [stored("-1.50")])).toEqual(new Set(["a"]));
  });

  it("a row already matched by its line uses up its stored copy first", () => {
    const old = cash("old", -1.5), fresh = cash("fresh", -1.5);
    expect(presentByContent([old, fresh], [fresh], [stored("-1.50")]).size).toBe(0);
  });

  it("compares in the user's currency, as stored", () => {
    const usd: MatchRecord = { key: "u", rate: 0.5, outcome: { row: 0, kind: "cash", date: "2026-10-02", currency: "USD", amount: -3, description: "Bar Roma", transfer: false } };
    expect(presentByContent([usd], [usd], [stored("-1.50")]).size).toBe(1);
  });

  it("matches trades on date, type, instrument, quantity, price and gross", () => {
    const trade: MatchRecord = { key: "t", rate: 1, outcome: { row: 0, kind: "investment", date: "2026-10-02", currency: "EUR", description: "Buy", type: "acquisto", name: "Vanguard FTSE All-World", isin: "IE00BK5BQT80", instrumentType: "etf", quantity: 2, price: 120.5, grossAmount: null, fees: 1, taxes: 0 } };
    const key = existingTradeKey({ date: "2026-10-02", type: "acquisto", isin: "IE00BK5BQT80", name: "x", quantity: "2.00000000", price: "120.500000", grossAmount: null });
    expect(presentByContent([trade], [trade], [key]).size).toBe(1);
    expect(presentByContent([trade], [trade], [key.replace("120.500000", "120.600000")]).size).toBe(0);
  });
});

describe("hints for the model", () => {
  it("classifies from the first lines", () => {
    expect(classifyFile("Data;Descrizione;Importo\n2026-10-02;Bar;-1,50")).toBe("bank");
    expect(classifyFile("Date,ISIN,Quantity,Price\n2026-10-02,IE00BK5BQT80,2,120")).toBe("broker");
    expect(classifyFile("a,b\n1,2")).toBe("unknown");
  });
  it("gives a date order only where one is usual", () => {
    expect(dateOrderHint("IT")).toBe("dmy"); expect(dateOrderHint("DE")).toBe("dmy"); expect(dateOrderHint("OTHER")).toBeNull();
  });
});
