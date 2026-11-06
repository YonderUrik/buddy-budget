import { describe, expect, it } from "vitest";
import { flexReport } from "./__fixtures__/ibkr-flex";
import { ibkrFlexAccountOf, IbkrFlexReportError, looksLikeIbkrFlex, parseIbkrFlexReport } from "./ibkr-flex";
import { parseBrokerStatement } from "./parse-statement";
import { detectImportProvider } from "./providers";

const TODAY = "2026-01-10";

describe("parseIbkrFlexReport", () => {
  it("reads a reconciled multi-currency report as an IBKR statement", () => {
    const parsed = parseIbkrFlexReport(flexReport(), TODAY);
    expect(parsed.preset).toBe("interactive-brokers");
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    const statement = parsed.statement!;
    expect(statement).toMatchObject({ account: "U90000001", currency: "EUR", from: "2025-01-01", to: "2025-12-31", issues: [] });
    expect(statement.cash).toEqual([
      expect.objectContaining({ currency: "EUR", opening: 0, closing: 597.25 }),
      expect.objectContaining({ currency: "USD", opening: 0, closing: 442.5 }),
    ]);
    for (const cash of statement.cash) expect(Math.abs(cash.difference)).toBeLessThan(1e-6);
    expect(statement.positions).toEqual([expect.objectContaining({ symbol: "MOCKETF", currency: "EUR", quantity: 10, price: 100, value: 1000 })]);
    expect(statement.nav.find((n) => n.label === "Total")?.value).toBe(1999.62);
  });

  it("maps trades and dividends with withholding to operations, keeping the ISIN and the ETF type", () => {
    const parsed = parseIbkrFlexReport(flexReport(), TODAY);
    expect(parsed.identities).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "isin:IE0000000004:EUR", symbol: "MOCKETF", type: "etf" }),
      expect.objectContaining({ key: "isin:US0000000002:USD", symbol: "MOCKUS" }),
    ]));
    expect(parsed.operations).toEqual([
      expect.objectContaining({ type: "acquisto", date: "2025-01-02", quantity: 10, price: 100, fees: 1, sourceCurrency: "EUR" }),
      expect.objectContaining({ type: "dividendo", date: "2025-03-15", grossAmount: 3, taxes: 0.5, sourceCurrency: "USD" }),
    ]);
  });

  it("keeps IBKR identifiers (conid, transactionID) in the stored records and counts a repeated transaction once", () => {
    const parsed = parseIbkrFlexReport(flexReport(), TODAY);
    const trade = parsed.records.find((r) => r.section === "Trades" && r.kind === "Data" && r.values.includes("MOCKETF"))!;
    expect(trade.values[trade.headers.indexOf("Conid")]).toBe("900001");
    expect(trade.values[trade.headers.indexOf("Transaction ID")]).toBe("8001");
    expect(parsed.records.filter((r) => r.section === "Interest" && r.kind === "Data")).toHaveLength(1);
    const lines = parsed.records.map((r) => r.line);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("gives the same fingerprint input for the same report generated twice", () => {
    const again = flexReport().replace('whenGenerated="20260101;083000"', 'whenGenerated="20260102;090000"');
    expect(parseIbkrFlexReport(again, TODAY).records).toEqual(parseIbkrFlexReport(flexReport(), TODAY).records);
  });

  it("refuses a query without the required sections, naming them", () => {
    try { parseIbkrFlexReport(flexReport({ omit: ["CashReport", "EquitySummaryInBase"] }), TODAY); expect.unreachable(); }
    catch (error) {
      expect(error).toBeInstanceOf(IbkrFlexReportError);
      expect((error as IbkrFlexReportError).code).toBe("missing_sections");
      expect((error as IbkrFlexReportError).sections).toEqual(["Cash Report", "Net Asset Value (NAV) in Base"]);
    }
  });

  it("refuses multi-account queries, unsupported date formats and malformed XML", () => {
    const two = flexReport().replace("</FlexStatements>", `${/<FlexStatement [\s\S]*<\/FlexStatement>/.exec(flexReport())![0]}</FlexStatements>`);
    expect(() => parseIbkrFlexReport(two, TODAY)).toThrow(expect.objectContaining({ code: "multiple_accounts" }));
    expect(() => parseIbkrFlexReport(flexReport({ from: "01/01/2025" }), TODAY)).toThrow(expect.objectContaining({ code: "date_format" }));
    expect(() => parseIbkrFlexReport(flexReport().replace("</FlexStatements>", ""), TODAY)).toThrow(expect.objectContaining({ code: "malformed" }));
  });

  it("flags unknown cash transaction types instead of dropping them", () => {
    const extra = `<CashTransaction accountId="U90000001" currency="EUR" type="Mystery Credit" description="?" dateTime="20250601" reportDate="20250601" amount="5" transactionID="9100" />`;
    const parsed = parseIbkrFlexReport(flexReport({ extraCash: extra }), TODAY);
    expect(parsed.issues).toEqual(expect.arrayContaining([expect.objectContaining({ severity: "error", message: expect.stringContaining("Mystery Credit") })]));
  });

  it("reports cash that does not reconcile when a section is left out of the query", () => {
    const parsed = parseIbkrFlexReport(flexReport({ omit: ["CashTransactions"] }), TODAY);
    expect(parsed.statement!.issues.join(" ")).toMatch(/Cassa EUR/);
  });
});

describe("Flex detection", () => {
  it("is recognised as Interactive Brokers by content and routed to the Flex reader", () => {
    expect(looksLikeIbkrFlex(flexReport())).toBe(true);
    expect(looksLikeIbkrFlex("Statement,Header,Field Name,Field Value")).toBe(false);
    expect(detectImportProvider(flexReport())).toBe("interactive-brokers");
    expect(parseBrokerStatement(flexReport(), TODAY).statement?.account).toBe("U90000001");
  });

  it("reads the account, base currency and opening date from the attributes", () => {
    expect(ibkrFlexAccountOf(flexReport())).toEqual({ accountId: "U90000001", currency: "EUR", dateOpened: "2025-01-01", from: "2025-01-01", to: "2025-12-31" });
  });
});
