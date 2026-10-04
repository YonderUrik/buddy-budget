import { describe, expect, it } from "vitest";
import { parseInteractiveBrokersActivity } from "./interactive-brokers";
import { brokerSeries } from "./__fixtures__/broker-series";
import { computePositions, findOversoldTransaction, type InvestmentTransactionInput } from "@/lib/calc/investments";

const parse = (text: string) => parseInteractiveBrokersActivity(text, "2026-10-04");

describe("broker statement reconciliation", () => {
  it("reconciles cash and NAV and retains native broker cost basis", () => {
    const s = parse(brokerSeries(2023)).statement!;
    expect(s.issues).toEqual([]);
    expect(s.cash).toEqual([{ currency: "EUR", opening: 0, closing: 999, calculated: 999, difference: 0 }]);
    expect(s.positions[0]).toMatchObject({ symbol: "PARENT", quantity: 10, costBasis: 1001 });
    expect(s.nav.at(-1)?.value).toBe(1999);
  });
  it("transfers spinoff shares and basis without inventing a cash investment or income", () => {
    const first = parse(brokerSeries(2023)); const second = parse(brokerSeries(2024));
    expect(second.issues.filter((i) => i.severity === "error")).toEqual([]);
    const adjustments = second.operations.filter((o) => o.type === "rettifica");
    expect(adjustments).toHaveLength(2);
    expect(adjustments.reduce((sum, o) => sum + o.grossAmount!, 0)).toBe(0);
    const rows: InvestmentTransactionInput[] = [...first.operations, ...second.operations].map((o, i) => ({ ...o, id: String(i), instrumentId: o.key, quantity: String(o.quantity), price: String(o.price), grossAmount: o.grossAmount === null ? null : String(o.grossAmount), fees: String(o.fees), taxes: String(o.taxes), fxRate: "1" }));
    expect(findOversoldTransaction(rows)).toBeNull();
    const identities = new Map([...first.identities, ...second.identities].map((i) => [i.key, { id: i.key, name: i.name!, currency: i.currency!, type: "azione" as const, priceUnit: "unita" as const }]));
    const positions = computePositions(rows, [...identities.values()], "2024-12-31");
    const values = [...positions.values()];
    expect(values.reduce((sum, p) => sum + p.totalBought, 0)).toBe(1001);
    expect(values.reduce((sum, p) => sum + p.income, 0)).toBe(0);
    expect(values.find((p) => p.instrumentId.includes("US9000000011"))?.costBasis).toBe(901);
    expect(values.find((p) => p.instrumentId.includes("US9000000029"))?.realizedGain).toBe(9);
  });
  it("blocks an unknown/partly sold spinoff basis rather than assigning zero cost", () => {
    const result = parse(brokerSeries(2024).replace(',-2,55,110,', ',-1,55,110,'));
    expect(result.issues.some((i) => i.severity === "error" && i.message.includes("lotti"))).toBe(true);
    expect(result.operations.some((o) => o.type === "rettifica")).toBe(false);
  });
  it("keeps an ISIN change under the new identity even when both metadata aliases exist", () => {
    const source = brokerSeries(2023).replace('Financial Instrument Information,Data,Stocks,CHILD', 'Financial Instrument Information,Data,Stocks,"PARENT, PARENT.OLD",Synthetic former parent,US9000000037\nFinancial Instrument Information,Data,Stocks,CHILD') + '\nCorporate Actions,Header,Asset Category,Currency,Report Date,Date/Time,Description,Quantity,Proceeds,Value,Realized P/L,Code\nCorporate Actions,Data,Stocks,EUR,2023-12-01,"2023-12-01, 00:00:00","PARENT.OLD(US9000000037) CUSIP/ISIN Change to (US9000000011) (PARENT, Synthetic Parent, US9000000011)",10,0,0,0,';
    const result = parse(source);
    expect(result.identities[0]).toMatchObject({ isin: "US9000000011", symbol: "PARENT" });
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
  });
  it("detects missing cash movements and inconsistent NAV", () => {
    const s = parse(brokerSeries(2023).replace('Deposit,2000', 'Deposit,1990').replace('Total,0,1999', 'Total,0,1990')).statement!;
    expect(s.issues).toHaveLength(2);
  });
  it("retains a transaction fee already included in commission without charging twice", () => {
    const source = brokerSeries(2023).replace('Commissions,EUR,-1', 'Commissions,EUR,-0.6') + '\nTransaction Fees,Header,Asset Category,Currency,Date/Time,Symbol,Description,Amount\nTransaction Fees,Data,Stocks,EUR,"2023-01-02, 10:00:00",PARENT,Exchange fee,-0.4';
    const s = parse(source).statement!;
    expect(s.issues).toEqual([]);
    expect(s.ledger.find((r) => r.kind === "Transaction Fees")).toMatchObject({ amount: -0.4, includedInCommission: true });
    expect(s.cash[0].calculated).toBe(999);
  });
});
