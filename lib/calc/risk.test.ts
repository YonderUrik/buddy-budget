import { describe, expect, it } from "vitest";
import { buildFxTable } from "./fx";
import { buildPriceIndex, type InstrumentInput, type InvestmentTransactionInput, type PriceInput } from "./investments";
import {
  averageRate,
  beta,
  computeCorrelationMatrix,
  computeDrawdown,
  computePortfolioRisk,
  correlation,
  observationsPerYear,
  pairCorrelation,
  riskObservations,
  sampleStd,
  sharpeRatio,
} from "./risk";

const ETF: InstrumentInput = { id: "etf", name: "ETF", type: "etf", currency: "EUR", priceUnit: "unita" };
const BENCH: InstrumentInput = { id: "bench", name: "Indice", type: "etf", currency: "EUR", priceUnit: "unita" };
const TODAY = new Date(2026, 8, 29);

function key(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isWeekday(date: Date): boolean {
  return date.getDay() !== 0 && date.getDay() !== 6;
}

/** Prezzi nei soli giorni feriali, con rendimenti giornalieri dati da `returnFor(i)`. */
function weekdayPrices(instrumentId: string, from: Date, to: Date, returnFor: (i: number) => number) {
  const prices: PriceInput[] = [];
  const returns: number[] = [];
  let level = 100;
  let i = 0;
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    if (!isWeekday(d)) continue;
    if (i > 0) {
      const r = returnFor(i);
      level *= 1 + r;
      returns.push(r);
    }
    prices.push({ instrumentId, date: key(d), close: String(level), source: "yahoo" });
    i += 1;
  }
  return { prices, returns };
}

function buy(date: string, quantity: number, price: number): InvestmentTransactionInput {
  return { id: date, instrumentId: "etf", type: "acquisto", date, quantity: String(quantity), price: String(price), fxRate: "1", fees: "0", taxes: "0", grossAmount: null };
}

describe("statistiche di base", () => {
  it("deviazione standard campionaria, correlazione e beta", () => {
    expect(sampleStd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(sampleStd([1])).toBeNull();
    const x = [0.01, -0.02, 0.03, 0.005, -0.01];
    expect(correlation(x, x.map((v) => v * 2))).toBeCloseTo(1);
    expect(correlation(x, x.map((v) => -v))).toBeCloseTo(-1);
    expect(beta(x.map((v) => v * 1.5), x)).toBeCloseTo(1.5);
    expect(correlation(x, [0, 0, 0, 0, 0])).toBeNull();
  });

  it("osservazioni per anno dai dati: 252 sedute su 365 giorni, 365 con le crypto", () => {
    expect(observationsPerYear(252, 365)).toBeCloseTo(252);
    expect(observationsPerYear(365, 365)).toBeCloseTo(365);
    expect(observationsPerYear(0, 10)).toBeNull();
  });

  it("Sharpe: senza tasso è media/dev.std × √n, col tasso sottrae la quota giornaliera", () => {
    const returns = [0.01, -0.005, 0.002, 0.004, -0.001];
    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    const std = sampleStd(returns)!;
    expect(sharpeRatio(returns, 252, 0)).toBeCloseTo((mean / std) * Math.sqrt(252));
    expect(sharpeRatio(returns, 252, 0.02)).toBeCloseTo(((mean - 0.02 / 252) / std) * Math.sqrt(252));
  });

  it("tasso medio sui giorni osservati con l'ultimo valore disponibile", () => {
    const rates = [
      { date: "2026-01-01", rate: 0.02 },
      { date: "2026-01-05", rate: 0.04 },
    ];
    expect(averageRate(rates, ["2026-01-02", "2026-01-06"])).toBeCloseTo(0.03);
    expect(averageRate(rates, ["2025-12-31"])).toBeNull();
    expect(averageRate([], ["2026-01-02"])).toBeNull();
  });
});

describe("riskObservations", () => {
  it("scarta i giorni senza investito e i weekend fermi, tiene i weekend che si muovono", () => {
    const obs = riskObservations([
      { date: "2026-09-25", ret: 0.01, gain: 1 },
      { date: "2026-09-26", ret: 0, gain: 0 },
      { date: "2026-09-27", ret: 0.02, gain: 2 },
      { date: "2026-09-28", ret: null, gain: 0 },
      { date: "2026-09-29", ret: 0, gain: 0 },
    ]);
    expect(obs.map((o) => o.date)).toEqual(["2026-09-25", "2026-09-27", "2026-09-29"]);
  });
});

describe("computeDrawdown", () => {
  it("trova picco, minimo e recupero sull'indice dei rendimenti", () => {
    const { max, series } = computeDrawdown("d0", [
      { date: "d1", ret: 0.1, gain: 0 },
      { date: "d2", ret: -0.2, gain: 0 },
      { date: "d3", ret: 0.1, gain: 0 },
      { date: "d4", ret: 0.2, gain: 0 },
      { date: "d5", ret: -0.05, gain: 0 },
    ]);
    expect(max).toMatchObject({ peakDate: "d1", troughDate: "d2", recoveryDate: "d4" });
    expect(max!.depth).toBeCloseTo(-0.2);
    expect(max!.current).toBeCloseTo(-0.05);
    expect(series.map((p) => p.date)).toEqual(["d1", "d2", "d3", "d4", "d5"]);
  });

  it("senza recupero la data di recupero è null; senza cali la perdita è zero", () => {
    expect(computeDrawdown("d0", [{ date: "d1", ret: -0.1, gain: 0 }]).max).toMatchObject({ peakDate: "d0", recoveryDate: null });
    expect(computeDrawdown("d0", [{ date: "d1", ret: 0.1, gain: 0 }]).max!.depth).toBe(0);
  });
});

describe("pairCorrelation", () => {
  it("usa solo i giorni in cui entrambi hanno una chiusura", () => {
    const a = new Map<string, number>();
    const b = new Map<string, number>();
    let la = 100;
    let lb = 50;
    for (let i = 0; i < 40; i += 1) {
      const r = Math.sin(i) / 50;
      la *= 1 + r;
      lb *= 1 + r;
      const date = `d${String(i).padStart(2, "0")}`;
      a.set(date, la);
      // b ha un giorno in più con un prezzo diverso che non deve contare, e un buco.
      if (i !== 10) b.set(date, lb);
    }
    b.set("d99-extra", 1);
    expect(pairCorrelation(a, b)).toBeCloseTo(1, 6);
  });

  it("con meno di 20 giorni in comune non stima niente", () => {
    const a = new Map([["d1", 1], ["d2", 2]]);
    expect(pairCorrelation(a, a)).toBeNull();
  });
});

describe("computePortfolioRisk", () => {
  const from = new Date(2025, 0, 2);
  const returnFor = (i: number) => Math.sin(i * 1.7) / 80;
  const { prices, returns } = weekdayPrices("etf", from, TODAY, returnFor);
  const benchmarkPrices = weekdayPrices("bench", from, TODAY, (i) => returnFor(i) / 2).prices;
  const transactions = [buy(key(from), 10, 100)];

  function risk(options: { benchmark?: InstrumentInput; rates?: { date: string; rate: number }[] } = {}) {
    return computePortfolioRisk({
      transactions,
      instruments: [ETF, BENCH],
      priceIndex: buildPriceIndex([...prices, ...benchmarkPrices], [], transactions),
      fx: buildFxTable([]),
      userCurrency: "EUR",
      period: "max",
      today: TODAY,
      benchmark: options.benchmark ?? null,
      riskFreeRates: options.rates ?? null,
    })!;
  }

  it("con un solo strumento la volatilità è quella dei suoi rendimenti di prezzo, sulle sole sedute", () => {
    const result = risk();
    // Il primo giorno misura l'acquisto rispetto alla chiusura (rendimento 0): è un'osservazione in più.
    const expected = sampleStd([0, ...returns])! * Math.sqrt(observationsPerYear(returns.length + 1, calendarDays())!);
    expect(result.observations).toBe(returns.length + 1);
    expect(result.volatility).toBeCloseTo(expected, 10);
    expect(result.fewData).toBe(false);
    expect(result.drawdown!.depth).toBeLessThan(0);
    expect(result.drawdownSeries.length).toBeGreaterThan(10);
  });

  it("beta 2 e correlazione 1 contro un indice che si muove la metà", () => {
    const result = risk({ benchmark: BENCH });
    expect(result.benchmark!.beta).toBeCloseTo(2, 2);
    expect(result.benchmark!.correlation).toBeCloseTo(1, 3);
    expect(result.benchmark!.volatility! * 2).toBeCloseTo(result.volatility!, 2);
  });

  it("lo Sharpe col tasso €STR è più basso di quello senza", () => {
    const withoutRate = risk();
    const withRate = risk({ rates: [{ date: "2025-01-01", rate: 0.03 }] });
    expect(withRate.riskFreeRate).toBeCloseTo(0.03);
    expect(withoutRate.riskFreeRate).toBeNull();
    expect(withRate.sharpe!).toBeLessThan(withoutRate.sharpe!);
  });

  it("con poche sedute niente numeri", () => {
    const short = computePortfolioRisk({
      transactions: [buy("2026-09-21", 1, 100)],
      instruments: [ETF],
      priceIndex: buildPriceIndex(prices, [], []),
      fx: buildFxTable([]),
      userCurrency: "EUR",
      period: "max",
      today: TODAY,
    })!;
    expect(short.volatility).toBeNull();
    expect(short.sharpe).toBeNull();
    expect(short.drawdown).toBeNull();
  });

  /** Giorni di calendario con qualcosa investito: dal giorno del primo acquisto a oggi. */
  function calendarDays(): number {
    return Math.round((TODAY.getTime() - from.getTime()) / 86_400_000) + 1;
  }
});

describe("computeCorrelationMatrix", () => {
  it("matrice simmetrica con 1 sulla diagonale", () => {
    const from = new Date(2026, 3, 1);
    const a = weekdayPrices("etf", from, TODAY, (i) => Math.sin(i) / 50).prices;
    const b = weekdayPrices("bench", from, TODAY, (i) => -Math.sin(i) / 50).prices;
    const matrix = computeCorrelationMatrix({
      instruments: [ETF, BENCH],
      priceIndex: buildPriceIndex([...a, ...b], []),
      fx: buildFxTable([]),
      userCurrency: "EUR",
      fromKey: "2026-04-01",
      toKey: "2026-09-29",
    });
    expect(matrix.values[0][0]).toBe(1);
    expect(matrix.values[0][1]).toBeCloseTo(-1, 2);
    expect(matrix.values[1][0]).toBe(matrix.values[0][1]);
  });
});
