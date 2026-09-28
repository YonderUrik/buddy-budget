import { describe, expect, it } from "vitest";
import { buildFxTable } from "./fx";
import {
  buildPortfolioSeries,
  buildPriceIndex,
  computeComposition,
  computeDailyPortfolioValues,
  computePortfolioSummary,
  computePositions,
  findOversoldTransaction,
  resolvePrice,
  type InstrumentInput,
  type InvestmentTransactionInput,
} from "./investments";

const ETF: InstrumentInput = { id: "etf", name: "VWCE", type: "etf", currency: "EUR", priceUnit: "unita" };
const USD_STOCK: InstrumentInput = { id: "aapl", name: "Apple", type: "azione", currency: "USD", priceUnit: "unita" };
const BTP: InstrumentInput = { id: "btp", name: "BTP", type: "obbligazione", currency: "EUR", priceUnit: "percentuale_nominale" };
const INSTRUMENTS = [ETF, USD_STOCK, BTP];

let nextId = 0;
function tx(partial: Partial<InvestmentTransactionInput> & Pick<InvestmentTransactionInput, "instrumentId" | "type" | "date">): InvestmentTransactionInput {
  nextId += 1;
  return {
    id: `t${nextId}`,
    quantity: "0",
    price: "0",
    fxRate: "1",
    fees: "0",
    taxes: "0",
    grossAmount: null,
    ...partial,
  };
}

const fx = buildFxTable([{ date: "2026-01-01", currency: "USD", perEur: "1.25" }]);

describe("computePositions", () => {
  it("calcola il costo medio ponderato su più acquisti, commissioni incluse", () => {
    const positions = computePositions(
      [
        tx({ instrumentId: "etf", type: "acquisto", date: "2026-01-10", quantity: "10", price: "100", fees: "2" }),
        tx({ instrumentId: "etf", type: "acquisto", date: "2026-02-10", quantity: "10", price: "120", fees: "2" }),
      ],
      INSTRUMENTS,
      "2026-12-31"
    );
    const p = positions.get("etf")!;
    expect(p.quantity).toBe(20);
    expect(p.costBasis).toBeCloseTo(2204);
    expect(p.averagePrice).toBeCloseTo(110.2);
    expect(p.investedNet).toBeCloseTo(2204);
  });

  it("una vendita parziale riduce le quote senza cambiare il costo medio e registra il realizzato", () => {
    const p = computePositions(
      [
        tx({ instrumentId: "etf", type: "acquisto", date: "2026-01-10", quantity: "10", price: "100" }),
        tx({ instrumentId: "etf", type: "vendita", date: "2026-03-10", quantity: "4", price: "150", fees: "1" }),
      ],
      INSTRUMENTS,
      "2026-12-31"
    ).get("etf")!;
    expect(p.quantity).toBe(6);
    expect(p.averagePrice).toBeCloseTo(100);
    expect(p.realizedGain).toBeCloseTo(4 * 150 - 1 - 400);
    expect(p.investedNet).toBeCloseTo(1000 - 599);
  });

  it("una vendita totale azzera quote e costo", () => {
    const p = computePositions(
      [
        tx({ instrumentId: "etf", type: "acquisto", date: "2026-01-10", quantity: "0.3", price: "100" }),
        tx({ instrumentId: "etf", type: "vendita", date: "2026-03-10", quantity: "0.3", price: "90" }),
      ],
      INSTRUMENTS,
      "2026-12-31"
    ).get("etf")!;
    expect(p.quantity).toBe(0);
    expect(p.costBasis).toBe(0);
    expect(p.averagePrice).toBeNull();
    expect(p.realizedGain).toBeCloseTo(-3);
  });

  it("gestisce le obbligazioni quotate in percentuale del nominale", () => {
    const p = computePositions(
      [tx({ instrumentId: "btp", type: "acquisto", date: "2026-01-10", quantity: "10000", price: "98.5" })],
      INSTRUMENTS,
      "2026-12-31"
    ).get("btp")!;
    expect(p.costBasis).toBeCloseTo(9850);
    expect(p.averagePrice).toBeCloseTo(98.5);
  });

  it("converte in valuta utente col cambio dell'operazione", () => {
    const p = computePositions(
      [tx({ instrumentId: "aapl", type: "acquisto", date: "2026-01-10", quantity: "2", price: "200", fxRate: "0.8" })],
      INSTRUMENTS,
      "2026-12-31"
    ).get("aapl")!;
    expect(p.costBasis).toBeCloseTo(320);
  });

  it("conta dividendi e cedole al netto delle imposte", () => {
    const p = computePositions(
      [
        tx({ instrumentId: "etf", type: "acquisto", date: "2026-01-10", quantity: "10", price: "100" }),
        tx({ instrumentId: "etf", type: "dividendo", date: "2026-06-10", grossAmount: "20", taxes: "5.2" }),
      ],
      INSTRUMENTS,
      "2026-12-31"
    ).get("etf")!;
    expect(p.income).toBeCloseTo(14.8);
    expect(p.quantity).toBe(10);
  });

  it("ignora le operazioni dopo la data richiesta", () => {
    const positions = computePositions(
      [tx({ instrumentId: "etf", type: "acquisto", date: "2026-05-10", quantity: "10", price: "100" })],
      INSTRUMENTS,
      "2026-04-30"
    );
    expect(positions.size).toBe(0);
  });
});

describe("findOversoldTransaction", () => {
  it("trova una vendita oltre le quote possedute", () => {
    const sell = tx({ instrumentId: "etf", type: "vendita", date: "2026-02-01", quantity: "11", price: "100" });
    const result = findOversoldTransaction([
      tx({ instrumentId: "etf", type: "acquisto", date: "2026-01-10", quantity: "10", price: "100" }),
      sell,
    ]);
    expect(result?.id).toBe(sell.id);
  });

  it("controlla la cronologia: una vendita prima dell'acquisto non è valida", () => {
    const sell = tx({ instrumentId: "etf", type: "vendita", date: "2026-01-01", quantity: "5", price: "100" });
    expect(findOversoldTransaction([sell, tx({ instrumentId: "etf", type: "acquisto", date: "2026-01-10", quantity: "10", price: "100" })])?.id).toBe(sell.id);
  });

  it("permette di vendere nello stesso giorno quanto comprato", () => {
    expect(
      findOversoldTransaction([
        tx({ instrumentId: "etf", type: "vendita", date: "2026-01-10", quantity: "10", price: "100" }),
        tx({ instrumentId: "etf", type: "acquisto", date: "2026-01-10", quantity: "10", price: "100" }),
      ])
    ).toBeNull();
  });
});

describe("prezzi", () => {
  it("il manuale vince sull'automatico nello stesso giorno, e l'ultimo prezzo vale nei giorni successivi", () => {
    const index = buildPriceIndex(
      [
        { instrumentId: "etf", date: "2026-09-24", close: "100", source: "yahoo" },
        { instrumentId: "etf", date: "2026-09-25", close: "101", source: "stooq" },
      ],
      [{ instrumentId: "etf", date: "2026-09-25", close: "105" }]
    );
    expect(resolvePrice(index, "etf", "2026-09-27")).toEqual({ date: "2026-09-25", close: 105, origin: "manuale" });
    expect(resolvePrice(index, "etf", "2026-09-24")?.origin).toBe("yahoo");
    expect(resolvePrice(index, "etf", "2026-09-01")).toBeNull();
  });

  it("usa il prezzo dell'operazione come ripiego finché non arriva un prezzo di mercato", () => {
    const buy = tx({ instrumentId: "etf", type: "acquisto", date: "2026-09-20", quantity: "1", price: "99" });
    const index = buildPriceIndex([{ instrumentId: "etf", date: "2026-09-20", close: "100", source: "yahoo" }], [], [buy]);
    expect(resolvePrice(index, "etf", "2026-09-20")?.origin).toBe("yahoo");
    const onlyTx = buildPriceIndex([], [], [buy]);
    expect(resolvePrice(onlyTx, "etf", "2026-09-21")).toEqual({ date: "2026-09-20", close: 99, origin: "operazione" });
  });
});

describe("computePortfolioSummary", () => {
  const transactions = [
    tx({ instrumentId: "etf", type: "acquisto", date: "2026-09-01", quantity: "10", price: "100" }),
    tx({ instrumentId: "aapl", type: "acquisto", date: "2026-09-01", quantity: "5", price: "200", fxRate: "0.8" }),
    tx({ instrumentId: "btp", type: "acquisto", date: "2026-09-01", quantity: "1000", price: "100" }),
  ];
  const priceIndex = buildPriceIndex(
    [
      { instrumentId: "etf", date: "2026-09-24", close: "110", source: "yahoo" },
      { instrumentId: "etf", date: "2026-09-25", close: "120", source: "yahoo" },
      { instrumentId: "aapl", date: "2026-09-25", close: "250", source: "yahoo" },
    ],
    []
  );

  it("calcola valore, guadagno, pesi e strumenti senza prezzo", () => {
    const summary = computePortfolioSummary({
      transactions,
      instruments: INSTRUMENTS,
      priceIndex,
      fx,
      userCurrency: "EUR",
      todayKey: "2026-09-26",
    });
    // ETF 10×120 = 1200; AAPL 5×250 USD = 1250/1.25 = 1000 EUR; BTP senza prezzo né ripiego.
    expect(summary.totalValue).toBeCloseTo(2200);
    expect(summary.unpricedCount).toBe(1);
    expect(summary.unrealizedGain).toBeCloseTo(200 + 200);
    expect(summary.dayChange).toBeCloseTo(100);
    expect(summary.dayChangePct).toBeCloseTo(100 / 1100);
    expect(summary.rows[0].instrument.id).toBe("etf");
    expect(summary.rows[0].weight).toBeCloseTo(1200 / 2200);
    expect(summary.rows.find((r) => r.instrument.id === "btp")?.value).toBeNull();
    expect(summary.totalGainPct).toBeCloseTo(400 / 2800);
  });

  it("non inventa un valore 0 per uno strumento senza prezzo", () => {
    const summary = computePortfolioSummary({
      transactions: [transactions[2]],
      instruments: INSTRUMENTS,
      priceIndex: buildPriceIndex([], []),
      fx,
      userCurrency: "EUR",
      todayKey: "2026-09-26",
    });
    expect(summary.totalValue).toBe(0);
    expect(summary.rows[0].value).toBeNull();
    expect(summary.dayChange).toBeNull();
  });
});

describe("serie e composizione", () => {
  const transactions = [
    tx({ instrumentId: "etf", type: "acquisto", date: "2026-09-20", quantity: "10", price: "100" }),
    tx({ instrumentId: "etf", type: "acquisto", date: "2026-09-23", quantity: "10", price: "100" }),
  ];
  const priceIndex = buildPriceIndex(
    [
      { instrumentId: "etf", date: "2026-09-20", close: "100", source: "yahoo" },
      { instrumentId: "etf", date: "2026-09-22", close: "110", source: "yahoo" },
    ],
    [],
    transactions
  );

  it("calcola valore e investito giorno per giorno ripetendo l'ultimo prezzo", () => {
    const points = computeDailyPortfolioValues({
      transactions,
      instruments: INSTRUMENTS,
      priceIndex,
      fx,
      userCurrency: "EUR",
      fromKey: "2026-09-19",
      toKey: "2026-09-23",
    });
    expect(points.map((p) => [p.date, p.value, p.invested])).toEqual([
      ["2026-09-19", 0, 0],
      ["2026-09-20", 1000, 1000],
      ["2026-09-21", 1000, 1000],
      ["2026-09-22", 1100, 1000],
      // Il 23 il prezzo dell'operazione (100) diventa l'ultimo prezzo noto.
      ["2026-09-23", 2000, 2000],
    ]);
  });

  it("la serie parte dalla prima operazione e per 1anno ha un punto per mese", () => {
    const series = buildPortfolioSeries({
      transactions,
      instruments: INSTRUMENTS,
      priceIndex,
      fx,
      userCurrency: "EUR",
      period: "1anno",
      today: new Date(2026, 9, 5),
    });
    expect(series.map((p) => p.date)).toEqual(["2026-09-30", "2026-10-05"]);
  });

  it("composizione per tipo e per valuta", () => {
    const summary = computePortfolioSummary({
      transactions: [
        tx({ instrumentId: "etf", type: "acquisto", date: "2026-09-01", quantity: "3", price: "100" }),
        tx({ instrumentId: "aapl", type: "acquisto", date: "2026-09-01", quantity: "1", price: "125", fxRate: "0.8" }),
      ],
      instruments: INSTRUMENTS,
      priceIndex: buildPriceIndex(
        [
          { instrumentId: "etf", date: "2026-09-01", close: "100", source: "yahoo" },
          { instrumentId: "aapl", date: "2026-09-01", close: "125", source: "yahoo" },
        ],
        []
      ),
      fx,
      userCurrency: "EUR",
      todayKey: "2026-09-02",
    });
    expect(computeComposition(summary.rows, "type")).toEqual([
      { key: "etf", value: 300, share: 0.75 },
      { key: "azione", value: 100, share: 0.25 },
    ]);
    expect(computeComposition(summary.rows, "currency").map((s) => s.key)).toEqual(["EUR", "USD"]);
  });
});
