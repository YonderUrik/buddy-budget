import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsvRecords } from "./csv";
import { IBKR_MAX_FILE_BYTES, parseInteractiveBrokersActivity } from "./interactive-brokers";
import { runImportSchema } from "@/lib/validation/investments-import";

const fixture = readFileSync(new URL("./__fixtures__/interactive-brokers.csv", import.meta.url), "utf8");
const parse = (text = fixture) => parseInteractiveBrokersActivity(text, "2026-10-03");

describe("Interactive Brokers Activity Statement", () => {
  it("normalizes stock orders, commissions and dividends with signed tax reversals", () => {
    const result = parse();
    expect(result.operations).toHaveLength(3);
    expect(result.operations[0]).toMatchObject({ type: "acquisto", quantity: 1000, price: 12.5, fees: 2.5, sourceCurrency: "USD", date: "2025-01-10", line: 9 });
    expect(result.operations[1]).toMatchObject({ type: "vendita", quantity: 2, price: 15, fees: 1 });
    expect(result.operations[2]).toMatchObject({ type: "dividendo", grossAmount: 100, taxes: 10 });
    expect(result.identities).toEqual([{ key: "isin:US0378331005:USD", symbol: "TEST", isin: "US0378331005", name: 'Synthetic "Test", Inc.', currency: "USD", symbolIsYahoo: false }]);
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(runImportSchema.safeParse({ dryRun: true, instruments: [{ key: result.identities[0].key, create: { source: "manuale", name: "Test", type: "azione", currency: "USD" } }], operations: result.operations }).success).toBe(true);
  });

  it("preserves every section, totals, repeated/empty headers, unknown data and multiline cells", () => {
    const result = parse('\uFEFF' + fixture.replaceAll("\n", "\r\n"));
    expect(result.records).toHaveLength(parseCsvRecords(fixture).length);
    expect(result.records.find((r) => r.section === "Trades" && r.values.includes("EUR.USD"))?.headers).toContain("Comm in EUR");
    expect(result.records.at(-1)).toMatchObject({ section: "Future Section", headers: ["Label", "", "Label"], values: ["First line\r\nSecond line", "", "kept"] });
    expect(result.issues.map((i) => i.section)).toEqual(expect.arrayContaining(["Trades", "Corporate Actions", "Deposits & Withdrawals", "Transaction Fees"]));
    expect(result.records.some((r) => r.section === "Account Information")).toBe(true);
  });

  it("tracks physical line numbers after multiline records", () => {
    expect(parseCsvRecords('a,"b\nc"\r\nd,e\r\nf,g').map((r) => r.line)).toEqual([1, 3, 4]);
  });

  it.each(['a,"unfinished', 'a,"closed"junk', 'a,b"c'])("rejects malformed CSV %s", (text) => {
    expect(() => parse(fixture + text)).toThrow();
  });

  it("rejects other CSV formats and oversized input", () => {
    expect(() => parse("Date,Amount\n2025-01-01,10")).toThrow(/Activity Statement/);
    expect(() => parse("x".repeat(IBKR_MAX_FILE_BYTES + 1))).toThrow(/5 MB/);
  });

  it.each([
    ["-2,15,15,30", "0,15,15,30"],
    ["-2,15,15,30", "-2,broken,15,30"],
    ["-2,15,15,30", '-2,"1,23",15,30'],
    ["2025-02-10", "2025-02-30"],
    ["2025-02-10", "2027-02-10"],
    ["30,-1,-25", "30,1,-25"],
  ])("reports invalid orders without coercing numbers or dates (%s)", (from, to) => {
    const result = parse(fixture.replace(from, to));
    expect(result.operations).toHaveLength(2);
    expect(result.issues.some((i) => i.line === 10 && i.severity === "error")).toBe(true);
  });

  it("does not attach withholding ambiguously or discard unmatched taxes", () => {
    const dividend = fixture.split("\n").find((r) => r.startsWith("Dividends,Data,USD"))!;
    const result = parse(fixture.replace(dividend, dividend + "\n" + dividend));
    expect(result.operations.every((o) => o.type !== "dividendo")).toBe(true);
    expect(result.issues.filter((i) => i.section === "Dividends" && i.severity === "error")).toHaveLength(2);
    expect(result.issues.filter((i) => i.section === "Withholding Tax")).toHaveLength(3);
  });

  it("reports negative dividends and net refunds instead of turning them into income/costs", () => {
    expect(parse(fixture.replace("Dividend),100", "Dividend),-100")).operations).toHaveLength(2);
    expect(parse(fixture.replace("US Tax,-10", "US Tax,10")).operations).toHaveLength(2);
  });

  it("keeps currency listings separate and falls back to broker symbols", () => {
    const result = parse(fixture.replace("Stocks,USD,TEST", "Stocks,EUR,TEST").replaceAll("US0378331005", "12345"));
    expect(result.identities.map((i) => i.key)).toEqual(["symbol:TEST:EUR", "symbol:TEST:USD"]);
    expect(result.identities.every((i) => !i.symbolIsYahoo)).toBe(true);
  });
  it("rejects files exceeding import limits", () => {
    const prefix = fixture.split("Trades,Header")[0];
    const header = fixture.split("\n").find((r) => r.startsWith("Trades,Header"))!;
    const trade = fixture.split("\n").find((r) => r.startsWith("Trades,Data"))!;
    expect(() => parse(prefix + header + "\n" + Array(5001).fill(trade).join("\n"))).toThrow(/limiti/);
  });

  it("reports truncated financial rows and malformed withholding", () => {
    const truncated = fixture.replace("30,-1,-25,4,0,C", "30,-1");
    expect(parse(truncated).issues.some((i) => i.line === 10 && i.severity === "error")).toBe(true);
    expect(parse(fixture.replace("US Tax,-10", "US Tax,invalid")).operations).toHaveLength(2);
  });

});
