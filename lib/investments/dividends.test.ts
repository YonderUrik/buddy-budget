import { describe, expect, it } from "vitest";
import { buildFxTable } from "@/lib/calc/fx";
import type { InstrumentInput, InvestmentTransactionInput } from "@/lib/calc/investments";
import type { TaxInstrument } from "@/lib/calc/taxes";
import {
  couponDates,
  dividendGrowth,
  findMissingIncome,
  forecastIncome,
  incomeByInstrument,
  incomeByMonth,
  shiftMonths,
  type IncomeInput,
} from "./dividends";

const ENEL: InstrumentInput = { id: "enel", name: "Enel", type: "azione", currency: "EUR", priceUnit: "unita" };
const AAPL: InstrumentInput = { id: "aapl", name: "Apple", type: "azione", currency: "USD", priceUnit: "unita" };
const BTP: InstrumentInput = { id: "btp", name: "BTP 2027", type: "obbligazione", currency: "EUR", priceUnit: "percentuale_nominale" };
const ETF: InstrumentInput = { id: "etf", name: "VHYL", type: "etf", currency: "EUR", priceUnit: "unita" };
const tax = (i: InstrumentInput, rate = 0.26): TaxInstrument => ({ ...i, taxRate: rate, harmonized: true });

let n = 0;
function op(instrumentId: string, type: InvestmentTransactionInput["type"], date: string, quantity: number, extra: Partial<InvestmentTransactionInput> = {}): InvestmentTransactionInput {
  n += 1;
  return { id: `o${n}`, instrumentId, type, date, quantity: String(quantity), price: "10", fxRate: "1", fees: "0", taxes: "0", grossAmount: null, ...extra };
}

function input(overrides: Partial<IncomeInput>): IncomeInput {
  return {
    transactions: [],
    instruments: [ENEL, AAPL, BTP, ETF],
    taxInstruments: [tax(ENEL), tax(AAPL), tax(BTP, 0.125), tax(ETF)],
    settings: [],
    dividends: [],
    fx: buildFxTable([{ date: "2020-01-01", currency: "USD", perEur: "1.25" }]),
    userCurrency: "EUR",
    todayKey: "2026-09-30",
    ...overrides,
  };
}

describe("date", () => {
  it("shiftMonths si ferma a fine mese", () => {
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftMonths("2026-03-15", -12)).toBe("2025-03-15");
  });
  it("couponDates a ritroso dalla scadenza", () => {
    expect(couponDates({ rate: 0.04, frequency: 2, maturityDate: "2027-03-01" }, "2025-10-01", "2026-12-31")).toEqual(["2026-03-01", "2026-09-01"]);
  });
});

describe("findMissingIncome", () => {
  const dividends = [
    { instrumentId: "enel", exDate: "2026-01-20", amount: "0.22" },
    { instrumentId: "enel", exDate: "2026-07-20", amount: "0.23" },
    { instrumentId: "enel", exDate: "2025-07-20", amount: "0.2" },
  ];

  it("propone gli stacchi in cui si possedevano quote, senza dividendo registrato vicino", () => {
    const missing = findMissingIncome(
      input({
        dividends,
        transactions: [
          op("enel", "acquisto", "2025-08-01", 100),
          op("enel", "dividendo", "2026-01-28", 0, { grossAmount: "22", taxes: "5.72" }),
          op("enel", "acquisto", "2026-07-20", 100), // lo stesso giorno dello stacco: non dà diritto
        ],
      }),
      []
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ date: "2026-07-20", quantity: 100, kind: "dividendo" });
    expect(missing[0].gross).toBeCloseTo(23);
    expect(missing[0].estimatedTax).toBeCloseTo(23 * 0.26);
  });

  it("gli stacchi prima del primo acquisto e quelli ignorati non si propongono", () => {
    const missing = findMissingIncome(
      input({ dividends, transactions: [op("enel", "acquisto", "2025-08-01", 100)] }),
      [{ instrumentId: "enel", date: "2026-07-20" }]
    );
    expect(missing.map((m) => m.date)).toEqual(["2026-01-20"]);
  });

  it("uno split dopo lo stacco: l'importo della fonte è per quota di oggi", () => {
    const missing = findMissingIncome(
      input({
        dividends: [{ instrumentId: "aapl", exDate: "2026-02-10", amount: "0.25" }],
        transactions: [op("aapl", "acquisto", "2025-01-10", 10), op("aapl", "split", "2026-05-01", 4)],
      }),
      []
    );
    expect(missing[0].quantity).toBe(10);
    expect(missing[0].gross).toBeCloseTo(10 * 4 * 0.25);
    expect(missing[0].fxRate).toBeCloseTo(0.8);
    expect(missing[0].estimatedTax).toBeCloseTo(10 * 0.8 * 0.26);
  });

  it("le cedole dai termini inseriti, con l'aliquota del titolo di Stato", () => {
    const missing = findMissingIncome(
      input({
        settings: [{ instrumentId: "btp", taxRate: null, taxHarmonized: null, couponRate: "0.04", couponFrequency: 2, maturityDate: "2027-03-01" }],
        transactions: [op("btp", "acquisto", "2025-10-15", 10000), op("btp", "cedola", "2026-03-02", 0, { grossAmount: "200" })],
      }),
      []
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ kind: "cedola", date: "2026-09-01" });
    expect(missing[0].gross).toBeCloseTo(200);
    expect(missing[0].estimatedTax).toBeCloseTo(25);
  });
});

describe("forecastIncome", () => {
  it("sposta di un anno gli stacchi dell'ultimo anno, con le quote e il cambio di oggi", () => {
    const forecast = forecastIncome(
      input({
        dividends: [
          { instrumentId: "aapl", exDate: "2025-11-10", amount: "0.25" },
          { instrumentId: "aapl", exDate: "2026-02-10", amount: "0.26" },
          { instrumentId: "aapl", exDate: "2025-08-10", amount: "0.24" }, // più di 12 mesi fa: già ripetuto
        ],
        transactions: [op("aapl", "acquisto", "2025-01-10", 100)],
      })
    );
    expect(forecast.events.map((e) => e.date)).toEqual(["2026-11-10", "2027-02-10"]);
    expect(forecast.totalGross).toBeCloseTo((25 + 26) * 0.8);
    expect(forecast.totalNet).toBeCloseTo((25 + 26) * 0.8 * 0.74);
    expect(forecast.months).toHaveLength(12);
    expect(forecast.months[0].key).toBe("2026-10");
    expect(forecast.months[1].gross).toBeCloseTo(20);
  });

  it("cedole e rimborso a scadenza; il rimborso non è un provento", () => {
    const forecast = forecastIncome(
      input({
        settings: [{ instrumentId: "btp", taxRate: null, taxHarmonized: null, couponRate: "0.04", couponFrequency: 2, maturityDate: "2027-03-01" }],
        transactions: [op("btp", "acquisto", "2025-10-15", 10000)],
      })
    );
    expect(forecast.events.map((e) => [e.kind, e.date])).toEqual([
      ["cedola", "2027-03-01"],
      ["rimborso", "2027-03-01"],
    ]);
    expect(forecast.totalGross).toBeCloseTo(200);
    expect(forecast.totalNet).toBeCloseTo(175);
  });

  it("senza storico della fonte usa i proventi registrati riproporzionati alle quote di oggi", () => {
    const forecast = forecastIncome(
      input({
        transactions: [
          op("etf", "acquisto", "2025-01-10", 100),
          op("etf", "dividendo", "2025-12-20", 0, { grossAmount: "40" }),
          op("etf", "acquisto", "2026-01-10", 100),
        ],
      })
    );
    expect(forecast.events).toHaveLength(1);
    expect(forecast.events[0]).toMatchObject({ date: "2026-12-20", basis: "storico" });
    expect(forecast.events[0].gross).toBeCloseTo(80);
  });

  it("segnala le obbligazioni senza termini né cedole registrate", () => {
    const forecast = forecastIncome(input({ transactions: [op("btp", "acquisto", "2025-10-15", 10000)] }));
    expect(forecast.bondsWithoutTerms).toEqual(["btp"]);
  });
});

describe("incomeByMonth", () => {
  it("lordo col cambio dell'operazione, ritenute e netto per mese e anno", () => {
    const years = incomeByMonth(
      [
        op("aapl", "dividendo", "2026-02-15", 0, { grossAmount: "25", fxRate: "0.8", taxes: "5.2" }),
        op("enel", "dividendo", "2025-07-25", 0, { grossAmount: "20", taxes: "5.2", fees: "1" }),
      ],
      "2026-09-30"
    );
    expect(years.map((y) => y.year)).toEqual([2026, 2025]);
    expect(years[0].months[1]).toEqual({ month: 2, gross: 20, withheld: 5.2, net: 14.8 });
    expect(years[1].net).toBeCloseTo(13.8);
  });
});

describe("dividendGrowth e incomeByInstrument", () => {
  it("crescita composta sugli ultimi anni completi", () => {
    const events = [2021, 2022, 2023, 2024, 2025].map((y, i) => ({ exDate: `${y}-06-01`, amount: 1 * 1.1 ** i }));
    const growth = dividendGrowth(events, 2026);
    expect(growth?.rate).toBeCloseTo(0.1);
    expect(growth?.years).toBe(4);
    expect(dividendGrowth([{ exDate: "2024-06-01", amount: 1 }], 2026)).toBeNull();
  });

  it("rendimento sul costo e attuale per strumento", () => {
    const data = input({
      dividends: [{ instrumentId: "enel", exDate: "2026-01-20", amount: "0.5" }],
      transactions: [op("enel", "acquisto", "2025-08-01", 100), op("enel", "dividendo", "2026-01-28", 0, { grossAmount: "50", taxes: "13" })],
    });
    const forecast = forecastIncome(data);
    const rows = incomeByInstrument(data, [{ instrument: ENEL, costBasis: 1000, value: 1250 }], forecast);
    expect(rows).toHaveLength(1);
    expect(rows[0].trailingNet).toBeCloseTo(37);
    expect(rows[0].yieldOnCost).toBeCloseTo(0.037);
    expect(rows[0].forecastGross).toBeCloseTo(50);
    expect(rows[0].currentYield).toBeCloseTo(0.04);
  });
});
