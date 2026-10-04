import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { looksLikeDegiro, parseDegiroAccount } from "./degiro";
import { detectImportProvider } from "./providers";
import { statementCashComponents } from "./broker-statement";
import { computePositions } from "@/lib/calc/investments";

const fixture = readFileSync(new URL("./__fixtures__/degiro-account.csv", import.meta.url), "utf8");
const parse = (csv: string) => parseDegiroAccount(csv, "2026-10-04");
describe("DEGIRO account CSV", () => {
  it("recognizes the source and retains every row, including internal transfers", () => {
    expect(looksLikeDegiro(fixture)).toBe(true); expect(detectImportProvider(fixture)).toBe("degiro");
    const result = parse(fixture); expect(result.records).toHaveLength(11); expect(result.issues).toEqual([]);
    expect(result.statement?.cash[0]).toMatchObject({ opening: 0, closing: 800, difference: 0 });
    expect(result.statement?.valuationAvailable).toBe(false);
    expect(result.statement?.ledger.some((r) => r.kind === "Degiro Cash Sweep Transfer")).toBe(false);
  });
  it("retains all nonzero native cash balances for conversion into the linked account", () => {
    const statement = parse(fixture).statement!;
    statement.cash.push({ currency: "USD", opening: 0, closing: 20, calculated: 20, difference: 0 });
    expect(statementCashComponents(statement)).toEqual([{ currency: "EUR", amount: 800 }, { currency: "USD", amount: 20 }]);
  });
  it("allocates order costs across fills once and includes purchase taxes in cost basis", () => {
    const p = parse(fixture); const buys = p.operations.filter((o) => o.type === "acquisto");
    expect(buys).toHaveLength(2); expect(buys.reduce((s, o) => s + o.fees, 0)).toBe(3); expect(buys.reduce((s, o) => s + o.taxes, 0)).toBe(1);
    const positions = computePositions(p.operations.map((o) => ({ ...o, id: String(o.line), instrumentId: o.key, quantity: String(o.quantity), price: String(o.price), fees: String(o.fees), taxes: String(o.taxes), grossAmount: o.grossAmount === null ? null : String(o.grossAmount), fxRate: "1" })), [{ id: p.identities[0].key, name: "Synthetic Parent", type: "azione", currency: "EUR", priceUnit: "unita" }], "2023-12-31");
    expect([...positions.values()][0]).toMatchObject({ quantity: 2, costBasis: 204, income: 4 });
  });
  it("blocks missing financial rows, malformed quantities and unsupported event types", () => {
    expect(parse(fixture.replace(/.*DEGIRO costi.*\n/, "")).issues.some((i) => i.severity === "error")).toBe(true);
    expect(() => parse(fixture.replace("Acquisto 1", "Acquisto 9"))).toThrow(/controvalore/);
    expect(parse(fixture.replace("Flatex Interest Income", "Unrecognized stock transfer")).issues.some((i) => i.severity === "error")).toBe(true);
  });
  it("nets fully reversed dividend and withholding rows while preserving their ledger", () => {
    const extra = '06-01-2023,10:01,03-01-2023,Synthetic Parent,US9000000011,Dividendo,,EUR,"5,00",EUR,"800,00",\n06-01-2023,10:01,03-01-2023,Synthetic Parent,US9000000011,Ritenuta sul dividendo,,EUR,"-1,00",EUR,"795,00",\n06-01-2023,10:00,03-01-2023,Synthetic Parent,US9000000011,Dividendo,,EUR,"-5,00",EUR,"796,00",\n06-01-2023,10:00,03-01-2023,Synthetic Parent,US9000000011,Ritenuta sul dividendo,,EUR,"1,00",EUR,"801,00",\n';
    const p = parse(fixture.replace('\n', '\n' + extra));
    expect(p.issues).toEqual([]); expect(p.operations.filter((o) => o.type === "dividendo")).toHaveLength(1);
  });
  it.each([["USD", "USD", "200,00", "180,00", "817,00", 100], ["GBP", "GBX", "2,00", "1,80", "995,20", 1]])("handles native %s execution FX and quoted %s units", (native, quoted, amount, euros, balance, price) => {
    const csv = fixture.split('\n')[0] + `
02-01-2023,10:00,02-01-2023,Synthetic Parent,US9000000011,Credito FX,,${native},"${amount}",${native},"0,00",order-test
02-01-2023,10:00,02-01-2023,Synthetic Parent,US9000000011,Prelievo FX,,EUR,"-${euros}",EUR,"${balance}",order-test
02-01-2023,10:00,02-01-2023,Synthetic Parent,US9000000011,DEGIRO costi di transazione e/o di terze parti,,EUR,"-3,00",EUR,"997,00",order-test
02-01-2023,10:00,02-01-2023,Synthetic Parent,US9000000011,Acquisto 2 Synthetic Parent@100 ${quoted} (US9000000011),,${native},"-${amount}",${native},"-${amount}",order-test
01-01-2023,10:00,01-01-2023,,,Deposito flatex,,EUR,"1000,00",EUR,"1000,00",
`;
    const p = parse(csv); expect(p.issues).toEqual([]);
    expect(p.operations[0]).toMatchObject({ price, sourceCurrency: native, costCurrency: "EUR", fees: 3, brokerFxToEur: 0.9 });
  });

});
