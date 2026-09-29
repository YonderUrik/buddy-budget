import { describe, expect, it } from "vitest";
import { buildFxTable } from "./fx";
import { buildPriceIndex, type InstrumentInput, type InvestmentTransactionInput } from "./investments";
import {
  annualize,
  computePortfolioReturns,
  computeTwrSeries,
  inflationBetween,
  moneyWeightedReturn,
  realReturn,
  simulateBenchmark,
  toDailyFlows,
  xirrDaily,
  type DailyFlow,
} from "./returns";

const ETF: InstrumentInput = { id: "etf", name: "ETF", type: "etf", currency: "EUR", priceUnit: "unita" };
const INDEX: InstrumentInput = { id: "idx", name: "Indice", type: "etf", currency: "USD", priceUnit: "unita" };

let nextId = 0;
function tx(partial: Partial<InvestmentTransactionInput> & Pick<InvestmentTransactionInput, "type" | "date">): InvestmentTransactionInput {
  nextId += 1;
  return { id: `t${nextId}`, instrumentId: "etf", quantity: "0", price: "0", fxRate: "1", fees: "0", taxes: "0", grossAmount: null, ...partial };
}

function flow(date: string, value: number, extra: Partial<DailyFlow> = {}): DailyFlow {
  return { date, value, inflow: 0, outflow: 0, income: 0, ...extra };
}

describe("toDailyFlows", () => {
  it("ricava entrate, uscite e proventi del giorno dai cumulati", () => {
    const flows = toDailyFlows([
      { date: "2026-01-01", value: 0, invested: 0, bought: 0, income: 0 },
      { date: "2026-01-02", value: 1000, invested: 1000, bought: 1000, income: 0 },
      { date: "2026-01-03", value: 600, invested: 450, bought: 1000, income: 5 },
    ]);
    expect(flows).toEqual([
      { date: "2026-01-02", value: 1000, inflow: 1000, outflow: 0, income: 0 },
      { date: "2026-01-03", value: 600, inflow: 0, outflow: 550, income: 5 },
    ]);
  });
});

describe("computeTwrSeries", () => {
  it("non dipende da quanto si versa e quando: due giorni al +10% fanno +21%", () => {
    const series = computeTwrSeries(0, [
      flow("d1", 110, { inflow: 100 }),
      // Le quote già possedute passano da 110 a 121 e si comprano altri 1000 in chiusura: il nuovo versamento
      // non gonfia né diluisce il rendimento del giorno.
      flow("d2", 1121, { inflow: 1000 }),
    ]);
    expect(series.at(-1)!.cumulative).toBeCloseTo(0.21);
  });

  it("una vendita totale in guadagno non rompe il calcolo (uscita a fine giornata)", () => {
    const series = computeTwrSeries(100, [flow("d1", 0, { outflow: 110 })]);
    expect(series.at(-1)!.cumulative).toBeCloseTo(0.1);
  });

  it("i proventi contano come rendimento e i giorni senza niente investito si saltano", () => {
    const series = computeTwrSeries(0, [flow("d1", 0), flow("d2", 100, { inflow: 100 }), flow("d3", 100, { income: 2 })]);
    expect(series.map((p) => p.cumulative)).toEqual([0, 0, expect.closeTo(0.02)]);
  });
});

describe("xirr e rendimento money-weighted", () => {
  it("un versamento unico che cresce del 10% in un anno rende il 10% annuo", () => {
    const mwr = moneyWeightedReturn(
      [
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 1100 },
      ],
      365
    )!;
    expect(mwr.annual).toBeCloseTo(0.1, 6);
    expect(mwr.period).toBeCloseTo(0.1, 6);
  });

  it("pesa i soldi per quanto tempo sono rimasti investiti", () => {
    // 1000 per un anno al 10% e altri 1000 solo nell'ultimo giorno a rendimento zero: il tasso annuo sta sotto il 10%.
    const daily = xirrDaily([
      { date: "2025-01-01", amount: -1000 },
      { date: "2025-12-31", amount: -1000 },
      { date: "2026-01-01", amount: 2100 },
    ])!;
    const annual = (1 + daily) ** 365 - 1;
    expect(annual).toBeGreaterThan(0.09);
    expect(annual).toBeLessThan(0.1);
  });

  it("regge periodi di anni con importi grandi (niente overflow nella ricerca)", () => {
    const flows = Array.from({ length: 24 }, (_, i) => ({ date: `${2024 + Math.floor((i + 9) / 12)}-${String(((i + 9) % 12) + 1).padStart(2, "0")}-05`, amount: -150_000 }));
    flows.push({ date: "2026-09-29", amount: 4_000_000 });
    const mwr = moneyWeightedReturn(flows, 760)!;
    expect(mwr).not.toBeNull();
    expect(mwr.annual).toBeGreaterThan(0.05);
    expect(mwr.annual).toBeLessThan(0.2);
  });

  it("senza flussi di segno opposto non c'è un tasso", () => {
    expect(xirrDaily([{ date: "2026-01-01", amount: -100 }])).toBeNull();
    expect(xirrDaily([{ date: "2026-01-01", amount: 100 }, { date: "2026-02-01", amount: 5 }])).toBeNull();
  });

  it("annualizza solo rendimenti possibili", () => {
    expect(annualize(0.21, 730)).toBeCloseTo(0.1);
    expect(annualize(-1, 30)).toBeNull();
    expect(annualize(0.1, 0)).toBeNull();
  });
});

describe("inflazione", () => {
  const points = [
    { month: "2025-01", value: 100 },
    { month: "2025-06", value: 101 },
    { month: "2026-01", value: 102 },
  ];

  it("usa il mese di inizio e l'ultimo mese disponibile entro la fine", () => {
    expect(inflationBetween(points, "2025-01-15", "2026-03-10")).toEqual({ rate: expect.closeTo(0.02), throughMonth: "2026-01" });
  });

  it("senza il mese di inizio o senza un mese successivo non c'è inflazione", () => {
    expect(inflationBetween(points, "2024-12-01", "2026-03-10")).toBeNull();
    expect(inflationBetween(points, "2026-01-05", "2026-01-30")).toBeNull();
  });

  it("il rendimento reale toglie l'inflazione in modo composto", () => {
    expect(realReturn(0.1, 0.02)).toBeCloseTo(1.1 / 1.02 - 1);
  });
});

describe("simulateBenchmark", () => {
  const prices: Record<string, number> = { d0: 100, d1: 100, d2: 120, d3: 120 };
  const priceAt = (key: string) => prices[key] ?? null;

  it("compra con le entrate e vende con uscite e proventi allo stesso prezzo del giorno", () => {
    const sim = simulateBenchmark("d0", 0, [flow("d1", 100, { inflow: 100 }), flow("d2", 150), flow("d3", 90, { outflow: 60 })], priceAt)!;
    // 1 quota a 100, vale 120; si vendono 60 → 0,5 quote a 120 = 60.
    expect(sim.value).toBeCloseTo(60);
    expect(sim.twr).toBeCloseTo(0.2);
    expect(sim.depleted).toBe(false);
  });

  it("non va sotto zero se il prelievo supera il valore simulato", () => {
    const sim = simulateBenchmark("d0", 0, [flow("d1", 100, { inflow: 100 }), flow("d2", 0, { outflow: 500 })], priceAt)!;
    expect(sim.value).toBe(0);
    expect(sim.depleted).toBe(true);
  });

  it("senza il prezzo di partenza non simula", () => {
    expect(simulateBenchmark("dx", 0, [flow("d1", 100, { inflow: 100 })], priceAt)).toBeNull();
  });
});

describe("computePortfolioReturns", () => {
  const transactions = [
    tx({ type: "acquisto", date: "2025-01-02", quantity: "10", price: "100" }),
    tx({ type: "acquisto", date: "2025-07-01", quantity: "10", price: "110" }),
  ];
  const priceIndex = buildPriceIndex(
    [
      { instrumentId: "etf", date: "2025-01-02", close: "100", source: "yahoo" },
      { instrumentId: "etf", date: "2025-07-01", close: "110", source: "yahoo" },
      { instrumentId: "etf", date: "2026-01-02", close: "121", source: "yahoo" },
      { instrumentId: "idx", date: "2024-12-31", close: "50", source: "yahoo" },
      { instrumentId: "idx", date: "2026-01-02", close: "55", source: "yahoo" },
    ],
    [],
    transactions
  );
  const fx = buildFxTable([{ date: "2024-12-01", currency: "USD", perEur: "1" }]);
  const today = new Date(2026, 0, 2);

  it("calcola TWR, money-weighted, annui, reale e confronto col benchmark su tutto il periodo", () => {
    const returns = computePortfolioReturns({
      transactions,
      instruments: [ETF],
      priceIndex,
      fx,
      userCurrency: "EUR",
      period: "max",
      today,
      benchmark: INDEX,
      inflation: [
        { month: "2025-01", value: 100 },
        { month: "2025-12", value: 102 },
      ],
    })!;
    expect(returns.baseKey).toBe("2025-01-01");
    // Il prezzo passa da 100 a 121: +21% per il portafoglio, qualunque sia il momento del secondo versamento.
    expect(returns.twr).toBeCloseTo(0.21);
    expect(returns.showAnnual).toBe(true);
    // Il secondo versamento ha reso solo il 10%: i tuoi soldi rendono meno del portafoglio.
    expect(returns.moneyWeighted!).toBeLessThan(0.21);
    expect(returns.moneyWeighted!).toBeGreaterThan(0.1);
    expect(returns.real!.value).toBeCloseTo(1.21 / 1.02 - 1);
    expect(returns.real!.throughMonth).toBe("2025-12");
    expect(returns.benchmarkStatus).toBe("ok");
    expect(returns.benchmark!.twr).toBeCloseTo(0.1);
    // 1000 → 20 quote a 50, 1100 → 22 quote a 50 (ultimo prezzo noto): 42 quote a 55.
    expect(returns.benchmark!.simulatedValue).toBeCloseTo(2310);
    expect(returns.benchmark!.portfolioValue).toBeCloseTo(2420);
    expect(returns.series[0]).toMatchObject({ portfolio: 0, benchmark: 0 });
    expect(returns.series.at(-1)!.portfolio).toBeCloseTo(0.21);
  });

  it("segnala un benchmark senza prezzi e non mostra i valori annui su un periodo breve", () => {
    const returns = computePortfolioReturns({
      transactions,
      instruments: [ETF],
      priceIndex: buildPriceIndex([], [], transactions),
      fx,
      userCurrency: "EUR",
      period: "1mese",
      today,
      benchmark: INDEX,
    })!;
    expect(returns.benchmarkStatus).toBe("missing_prices");
    expect(returns.showAnnual).toBe(false);
    expect(returns.twrAnnual).toBeNull();
  });

  it("senza operazioni non c'è niente da calcolare", () => {
    expect(
      computePortfolioReturns({ transactions: [], instruments: [ETF], priceIndex: new Map(), fx, userCurrency: "EUR", period: "max", today })
    ).toBeNull();
  });
});
