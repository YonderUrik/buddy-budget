import { describe, expect, it } from "vitest";
import { tradeRepublicCsv, trRows } from "./__fixtures__/trade-republic";
import { parseBrokerStatement } from "./parse-statement";
import { detectImportProvider } from "./providers";
import { runImportSchema } from "@/lib/validation/investments-import";
import { orderStatementFiles } from "./batch";
import { planImport } from "./plan";
const csv = tradeRepublicCsv();
const parse = (text = csv) => parseBrokerStatement(text, "2026-10-06");
describe("Trade Republic complete export", () => {
  it("detects BOM exports and accounts for every source row once", () => {
    expect(detectImportProvider('\uFEFF' + csv)).toBe('trade-republic');
    const p = parse();
    expect(p.operations).toHaveLength(2);
    expect(p.cashMovements).toHaveLength(6);
    expect(p.records).toHaveLength(9);
    expect(p.statement?.ledger).toHaveLength(8);
    expect(p.statement?.cash[0].closing).toBeCloseTo(774.4);
    expect(p.cashMovements?.find((m) => m.merchantCategoryCode === '5411')).toMatchObject({ amount: -25, description: 'Example shop, ltd' });
    expect(p.cashMovements?.find((m) => m.description === 'INTEREST_PAYMENT')?.amount).toBe(7.4);
    expect(p.identities[0]).toMatchObject({ type: 'crypto', symbol: 'ETH', currency: 'EUR' });
  });
  it("retains tiny sales rounded to zero cash with their real execution price", () => {
    const p = parse();
    expect(p.operations[1]).toMatchObject({ quantity: 0.000002, price: 2000, fees: 1 });
    expect(planImport(p.operations.map((o) => ({ ...o, instrumentId: o.key })), []).every((r) => r.status === 'new')).toBe(true);
  });
  it("allows cash-only exports through request validation and multi-file preparation", () => {
    const text = tradeRepublicCsv(trRows.filter((r) => r.category !== 'TRADING'));
    const parsed = parse(text);
    expect(runImportSchema.safeParse({ dryRun: true, statementCsv: text, operations: [], instruments: [] }).success).toBe(true);
    expect(runImportSchema.safeParse({ dryRun: true, operations: [], instruments: [] }).success).toBe(false);
    expect(orderStatementFiles([{ name: 'cash.csv', text, parsed }])).toHaveLength(1);
  });
  it.each<Record<string, string>>([
    { amount: '12oops' }, { currency: 'EURO' }, { date: '2027-01-01' },
    { category: 'UNKNOWN' }, { account_type: 'OTHER' }, { transaction_id: '' },
  ])("rejects malformed rows instead of silently dropping them: %j", (patch) => {
    expect(() => parse(tradeRepublicCsv([{ ...trRows[0], ...patch }]))).toThrow();
  });
  it("imports free crypto receipts (staking, transfers in) as purchases without cash", () => {
    const receipt = { category: 'DELIVERY', type: 'FREE_RECEIPT', asset_class: 'CRYPTO', name: 'Solana', symbol: 'SOL', shares: '0.003', price: '100.5', amount: '', fee: '', tax: '', description: 'FREE_RECEIPT SOL' };
    const p = parse(tradeRepublicCsv([...trRows, receipt]));
    expect(p.operations).toHaveLength(3);
    expect(p.operations[2]).toMatchObject({ type: 'acquisto', quantity: 0.003, price: 100.5, fees: 0, taxes: 0 });
    expect(p.cashMovements).toHaveLength(6);
    expect(p.statement?.cash[0].closing).toBeCloseTo(774.4);
    expect(p.issues).toMatchObject([{ severity: 'warning' }]);
    expect(p.records).toHaveLength(10);
  });
  it.each<Record<string, string>>([{ asset_class: 'STOCK' }, { shares: '' }, { price: '0' }, { amount: '5' }])("rejects invalid free receipts: %j", (patch) => {
    const receipt = { category: 'DELIVERY', type: 'FREE_RECEIPT', asset_class: 'CRYPTO', symbol: 'SOL', shares: '1', price: '100', ...patch };
    expect(() => parse(tradeRepublicCsv([receipt]))).toThrow();
  });
  it("preserves the booking date when UTC datetime falls on the previous day", () => {
    expect(parse(tradeRepublicCsv([{ ...trRows[0], date: '2024-01-02', datetime: '2024-01-01T23:30:00Z' }])).cashMovements?.[0].date).toBe('2024-01-02');
  });
  it("accepts taxes booked weeks after their accounting date but not before it", () => {
    const tax = { type: 'TAX', amount: '0', tax: '-0.07', date: '2024-01-01', datetime: '2024-03-18T05:50:17Z' };
    expect(parse(tradeRepublicCsv([tax])).cashMovements?.[0]).toMatchObject({ date: '2024-01-01', amount: -0.07 });
    expect(() => parse(tradeRepublicCsv([{ ...tax, datetime: '2023-11-01T05:50:17Z' }]))).toThrow('data');
  });
  it("rejects duplicate source IDs and unsupported security events", () => {
    expect(() => parse(tradeRepublicCsv([{ ...trRows[0], transaction_id: 'same' }, { ...trRows[0], transaction_id: 'same' }]))).toThrow('duplicato');
    expect(() => parse(tradeRepublicCsv([{ ...trRows[1], type: 'SPLIT' }]))).toThrow('non supportata');
  });
});
