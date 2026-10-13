import { describe, expect, it } from "vitest";
import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex, type InstrumentInput, type InvestmentTransactionInput, type PriceInput } from "@/lib/calc/investments";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import { historicalReturn, resolveExpectedReturn, withExpectedReturn, type HistoricalReturnInput, type HistoricalReturnResult } from "./historical-return";

const ETF: InstrumentInput = { id: "etf", name: "ETF", type: "etf", currency: "EUR", priceUnit: "unita" };
const TODAY = new Date(2026, 9, 12);

function buy(date: string, quantity: number, price: number): InvestmentTransactionInput {
  return { id: date, instrumentId: "etf", type: "acquisto", date, quantity: String(quantity), price: String(price), fxRate: "1", fees: "0", taxes: "0", grossAmount: null };
}

function price(date: string, close: number): PriceInput {
  return { instrumentId: "etf", date, close: String(close), source: "yahoo" };
}

function input(transactions: InvestmentTransactionInput[], prices: PriceInput[], extra: Partial<HistoricalReturnInput> = {}): HistoricalReturnInput {
  return {
    transactions,
    instruments: [ETF],
    priceIndex: buildPriceIndex(prices, [], transactions),
    fx: buildFxTable([]),
    userCurrency: "EUR",
    inflation: [],
    today: TODAY,
    window: { fromKey: "2024-10-12", toKey: "2026-10-12" },
    currentValue: 20_000,
    unpricedCount: 0,
    ...extra,
  };
}

describe("historicalReturn", () => {
  it("usa gli ultimi 24 mesi e non conta i versamenti come guadagno", () => {
    // +21% in due anni (10% l'anno); a metà si versano altri 11.000 € al prezzo del giorno.
    const r = historicalReturn(
      input([buy("2024-01-02", 100, 100), buy("2025-10-10", 100, 110)], [price("2024-10-01", 100), price("2025-10-10", 110), price("2026-10-09", 121)])
    );
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.months).toBe(24);
    expect(r.nominal).toBeCloseTo(0.1, 2);
    expect(r.real).toBeNull();
  });

  it("con il periodo di 12 mesi usa solo gli ultimi 12", () => {
    const r = historicalReturn(input([buy("2025-04-01", 100, 100)], [price("2025-10-01", 100), price("2026-10-09", 105)], { window: { fromKey: "2025-10-12", toKey: "2026-10-12" } }));
    expect(r).toMatchObject({ status: "ok", months: 12, shorterThanPeriod: false });
    if (r.status === "ok") expect(r.nominal).toBeCloseTo(0.05, 2);
  });

  it("se si investe da meno del periodo scelto parte dal primo acquisto", () => {
    const r = historicalReturn(input([buy("2025-04-12", 100, 100)], [price("2025-04-12", 100), price("2026-10-09", 110)]));
    expect(r).toMatchObject({ status: "ok", months: 18, shorterThanPeriod: true });
    if (r.status === "ok") expect(r.nominal).toBeCloseTo(Math.pow(1.1, 365 / 548) - 1, 2);
  });

  it("un periodo scelto nel passato usa solo quei mesi", () => {
    const prices = [price("2023-12-29", 100), price("2024-12-31", 120), price("2026-10-09", 90)];
    const r = historicalReturn(input([buy("2023-06-01", 100, 100)], prices, { window: { fromKey: "2024-01-01", toKey: "2024-12-31" } }));
    expect(r).toMatchObject({ status: "ok", months: 12, toKey: "2024-12-31" });
    if (r.status === "ok") expect(r.nominal).toBeCloseTo(0.2, 2);
  });

  it("sotto i 12 mesi di periodo non annualizza", () => {
    const r = historicalReturn(input([buy("2023-06-01", 100, 100)], [price("2026-10-09", 105)], { window: { fromKey: "2026-04-01", toKey: "2026-09-30" } }));
    expect(r).toEqual({ status: "manca", reason: "periodo-breve" });
  });

  it("tiene conto dell'inflazione osservata se l'indice copre il periodo", () => {
    const inflation = [
      { month: "2025-10", value: 100 },
      { month: "2026-10", value: 103 },
    ];
    const r = historicalReturn(input([buy("2025-04-01", 100, 100)], [price("2025-10-01", 100), price("2026-10-09", 105)], { inflation, window: { fromKey: "2025-10-12", toKey: "2026-10-12" } }));
    expect(r.status === "ok" ? r.real : null).toBeCloseTo(1.05 / 1.03 - 1, 2);
  });

  it("non propone un numero senza storico, patrimonio o prezzi sufficienti", () => {
    expect(historicalReturn(input([], []))).toEqual({ status: "manca", reason: "nessun-investimento" });
    expect(historicalReturn(input([buy("2026-05-01", 100, 100)], [price("2026-10-09", 105)]))).toEqual({ status: "manca", reason: "storico-breve" });
    expect(historicalReturn(input([buy("2024-01-02", 1, 100)], [], { currentValue: 500 }))).toEqual({ status: "manca", reason: "patrimonio-basso" });
    expect(historicalReturn(input([buy("2024-01-02", 100, 100)], [], { unpricedCount: 1 }))).toEqual({ status: "manca", reason: "prezzi-mancanti" });
  });
});

describe("resolveExpectedReturn", () => {
  const ok = (nominal: number, real: number | null = null): HistoricalReturnResult => ({ status: "ok", months: 24, shorterThanPeriod: false, fromKey: "2024-10-12", toKey: "2026-10-12", nominal, real });

  it("in automatico usa il reale dello storico, con l'inflazione delle ipotesi se manca quella osservata", () => {
    const info = resolveExpectedReturn(DEFAULT_ASSUMPTIONS, ok(0.1));
    expect(info.source).toBe("storico");
    expect(info.value).toBeCloseTo(1.1 / 1.02 - 1, 3);
    expect(info.high).toBe(false);
    expect(withExpectedReturn(DEFAULT_ASSUMPTIONS, info).expectedReturn).toBe(info.value);
  });

  it("senza storico torna al valore prudente, e il valore scelto a mano vince sempre", () => {
    expect(resolveExpectedReturn(DEFAULT_ASSUMPTIONS, { status: "manca", reason: "storico-breve" })).toMatchObject({ source: "prudente", value: 0.04 });
    const manual = resolveExpectedReturn({ ...DEFAULT_ASSUMPTIONS, expectedReturnAuto: false, expectedReturn: 0.06 }, ok(0.2, 0.18));
    expect(manual).toMatchObject({ source: "manuale", value: 0.06, historyReal: 0.18 });
  });

  it("uno storico fuori scala si ferma al 50% e fa scattare l'avviso", () => {
    const info = resolveExpectedReturn(DEFAULT_ASSUMPTIONS, ok(1.2, 1.1));
    expect(info).toMatchObject({ value: 0.5, clamped: true, high: true });
    expect(resolveExpectedReturn(DEFAULT_ASSUMPTIONS, ok(-0.2, -0.22))).toMatchObject({ value: -0.02, clamped: true, high: false });
  });
});
