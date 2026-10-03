import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Instrument } from "@/lib/db/schema/investments";
import type { RunImportInput } from "@/lib/validation/investments-import";

const mocks = vi.hoisted(() => ({ values: vi.fn(), transaction: vi.fn(), instrument: vi.fn(), rates: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("../instruments", () => ({ findVisibleInstrument: mocks.instrument }));
vi.mock("../data", () => ({
  getOrCreateDefaultPortfolio: vi.fn(async () => ({ id: "portfolio" })),
  loadRatesBetween: mocks.rates,
  loadUserTransactions: vi.fn(async () => []),
}));
import { runImport, type ImportDeps } from "./execute";

const instrument = { id: "instrument", currency: "USD" } as Instrument;
const deps: ImportDeps = {
  userCurrency: "EUR", todayKey: "2026-10-03",
  createInstrument: vi.fn(), fetchFx: vi.fn(async () => {}), ensureHistory: vi.fn(async () => {}),
};
const input = (sourceCurrency: string | undefined = "USD"): RunImportInput => ({
  dryRun: false, instruments: [{ key: "test", instrumentId: "instrument" }],
  operations: [{ key: "test", line: 1, type: "acquisto", date: "2025-01-10", quantity: 1, price: 100, fees: 2, taxes: 4, grossAmount: null, note: null, sourceCurrency }],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.instrument.mockResolvedValue(instrument);
  mocks.rates.mockResolvedValue([{ date: "2025-01-10", currency: "USD", perEur: "2" }]);
  mocks.transaction.mockImplementation(async (fn) => fn({ insert: () => ({ values: mocks.values }) }));
});

describe("import source currency", () => {
  it("converts source costs exactly once while keeping prices in instrument currency", async () => {
    expect((await runImport("user", input(), deps)).inserted).toBe(1);
    expect(mocks.values).toHaveBeenCalledWith([expect.objectContaining({ price: "100", fxRate: "0.5", fees: "1.00", taxes: "2.00" })]);
  });
  it("preserves existing imports whose costs are already in user currency", async () => {
    const body = input();
    delete body.operations[0].sourceCurrency;
    await runImport("user", body, deps);
    expect(mocks.values).toHaveBeenCalledWith([expect.objectContaining({ fees: "2.00", taxes: "4.00" })]);
  });
  it("rejects currency mismatch and missing FX without saving", async () => {
    expect((await runImport("user", input("CHF"), deps)).counts.error).toBe(1);
    mocks.rates.mockResolvedValue([]);
    expect((await runImport("user", input(), deps)).counts.error).toBe(1);
    expect(mocks.values).not.toHaveBeenCalled();
    expect(deps.fetchFx).toHaveBeenCalled();
  });
  it("checks FX for proposed instruments during dry run and never writes", async () => {
    const body = input();
    body.dryRun = true;
    body.instruments = [{ key: "test", create: { source: "manuale", name: "Test", type: "azione", currency: "USD" } }];
    mocks.rates.mockResolvedValue([]);
    expect((await runImport("user", body, deps)).counts.error).toBe(1);
    expect(mocks.values).not.toHaveBeenCalled();
    expect(deps.createInstrument).not.toHaveBeenCalled();
  });
});
