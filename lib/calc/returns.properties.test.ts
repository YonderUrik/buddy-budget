/**
 * Verifiche di significato dei rendimenti: valori noti da manuale e proprietà che devono valere per qualunque
 * sequenza di operazioni. Gli scenari casuali sono deterministici (seme fisso), quindi i test sono ripetibili.
 */
import { describe, expect, it } from "vitest";
import { buildFxTable } from "./fx";
import {
  buildPriceIndex,
  computePortfolioSummary,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type PriceInput,
} from "./investments";
import { buildReturnHeatmap } from "./return-heatmap";
import { computeHistoryDailyReturns, computePortfolioReturns, inflationBetween, moneyWeightedReturn, realReturn } from "./returns";

const ETF: InstrumentInput = { id: "etf", name: "ETF", type: "etf", currency: "EUR", priceUnit: "unita" };
const TODAY_KEY = "2026-09-29";
const TODAY = new Date(2026, 8, 29);

/** Generatore pseudo-casuale deterministico (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function key(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Scenario con un solo strumento: prezzi giornalieri (anche nel weekend, per semplicità) e operazioni tutte eseguite
 * al prezzo di chiusura, senza commissioni né proventi. In questo caso il rendimento del portafoglio deve essere
 * esattamente la variazione del prezzo, qualunque cosa si versi o si prelevi.
 */
function closePriceScenario(seed: number) {
  const random = rng(seed);
  const prices: PriceInput[] = [];
  const closes = new Map<string, number>();
  let level = 100;
  for (let d = new Date(2024, 0, 1); key(d) <= TODAY_KEY; d.setDate(d.getDate() + 1)) {
    level *= 1 + (random() - 0.49) * 0.03;
    closes.set(key(d), level);
    prices.push({ instrumentId: "etf", date: key(d), close: String(level), source: "yahoo" });
  }
  const transactions: InvestmentTransactionInput[] = [];
  let held = 0;
  let n = 0;
  for (let d = new Date(2024, 0, 10); key(d) < TODAY_KEY; d.setDate(d.getDate() + 1 + Math.floor(random() * 20))) {
    const price = closes.get(key(d))!;
    const selling = held > 0 && random() < 0.3;
    const quantity = selling ? held * (0.2 + random() * 0.8) : 1 + random() * 10;
    held += selling ? -quantity : quantity;
    n += 1;
    transactions.push({
      id: `t${n}`,
      instrumentId: "etf",
      type: selling ? "vendita" : "acquisto",
      date: key(d),
      quantity: String(quantity),
      price: String(price),
      fxRate: "1",
      fees: "0",
      taxes: "0",
      grossAmount: null,
    });
  }
  const priceIndex = buildPriceIndex(prices, [], transactions);
  return { transactions, closes, common: { transactions, instruments: [ETF], priceIndex, fx: buildFxTable([]), userCurrency: "EUR" } };
}

describe("valori noti", () => {
  it("XIRR: esempio della documentazione di Excel (37,34%)", () => {
    const mwr = moneyWeightedReturn(
      [
        { date: "2008-01-01", amount: -10000 },
        { date: "2008-03-01", amount: 2750 },
        { date: "2008-10-30", amount: 4250 },
        { date: "2009-02-15", amount: 3250 },
        { date: "2009-04-01", amount: 2750 },
      ],
      456
    )!;
    expect(mwr.annual).toBeCloseTo(0.373362535, 6);
  });

  it("rendimento reale: +10% con inflazione al 3% è +6,80%", () => {
    expect(realReturn(0.1, 0.03)).toBeCloseTo(0.0679612, 6);
    expect(inflationBetween([{ month: "2025-01", value: 100 }, { month: "2026-01", value: 103 }], "2025-01-10", "2026-01-31")!.rate).toBeCloseTo(0.03);
  });
});

describe("proprietà su scenari casuali", () => {
  for (const seed of [11, 22, 33, 44, 55]) {
    describe(`scenario ${seed}`, () => {
      const { transactions, closes, common } = closePriceScenario(seed);
      const first = transactions[0].date;

      it("con operazioni al prezzo di chiusura il TWR è la variazione del prezzo, su ogni periodo", () => {
        for (const period of ["1mese", "3mesi", "1anno", "max"] as const) {
          const returns = computePortfolioReturns({ ...common, period, today: TODAY })!;
          const priceReturn = closes.get(TODAY_KEY)! / closes.get(returns.baseKey)! - 1;
          // Su "max" la base è il giorno prima del primo acquisto, quando non c'era niente: conta dal primo acquisto.
          const expected = period === "max" ? closes.get(TODAY_KEY)! / closes.get(first)! - 1 : priceReturn;
          expect(returns.twr!).toBeCloseTo(expected, 9);
        }
      });

      it("un benchmark identico al portafoglio dà lo stesso valore finale e lo stesso rendimento", () => {
        for (const period of ["3mesi", "max"] as const) {
          const returns = computePortfolioReturns({ ...common, period, today: TODAY, benchmark: ETF })!;
          expect(returns.benchmark!.simulatedValue).toBeCloseTo(returns.benchmark!.portfolioValue, 6);
          expect(returns.benchmark!.moneyWeighted!).toBeCloseTo(returns.moneyWeighted!, 6);
          if (period !== "max") expect(returns.benchmark!.twr).toBeCloseTo(returns.twr!, 9);
        }
      });

      it("la somma dei guadagni giornalieri è il guadagno totale del portafoglio", () => {
        const daily = computeHistoryDailyReturns({ ...common, today: TODAY });
        const summary = computePortfolioSummary({ ...common, todayKey: TODAY_KEY });
        expect(daily.reduce((sum, d) => sum + d.gain, 0)).toBeCloseTo(summary.totalGain, 6);
      });

      it("guadagno totale = valore di oggi + incassato − acquistato", () => {
        const summary = computePortfolioSummary({ ...common, todayKey: TODAY_KEY });
        let cashFlow = 0;
        for (const t of transactions) cashFlow += (t.type === "vendita" ? 1 : -1) * Number(t.quantity) * Number(t.price);
        expect(summary.totalGain).toBeCloseTo(summary.totalValue + cashFlow, 6);
      });

      it("mesi e anni della heatmap composti danno il TWR complessivo", () => {
        const daily = computeHistoryDailyReturns({ ...common, today: TODAY });
        const twr = computePortfolioReturns({ ...common, period: "max", today: TODAY })!.twr!;
        for (const grouping of ["settimana", "mese", "anno"] as const) {
          const heatmap = buildReturnHeatmap(daily, grouping, TODAY_KEY)!;
          const cells = heatmap.rows.flatMap((r) => r.cells).filter((c) => c && c.ret !== null);
          const compounded = cells.reduce((acc, c) => acc * (1 + c!.ret!), 1) - 1;
          expect(compounded).toBeCloseTo(twr, 9);
        }
      });
    });
  }

  it("con un solo versamento il rendimento dei tuoi soldi coincide col TWR", () => {
    const { closes } = closePriceScenario(99);
    const tx: InvestmentTransactionInput = {
      id: "t1", instrumentId: "etf", type: "acquisto", date: "2024-03-01", quantity: "10",
      price: String(closes.get("2024-03-01")), fxRate: "1", fees: "0", taxes: "0", grossAmount: null,
    };
    const prices = [...closes.entries()].map(([date, close]) => ({ instrumentId: "etf", date, close: String(close), source: "yahoo" as const }));
    const returns = computePortfolioReturns({
      transactions: [tx], instruments: [ETF], priceIndex: buildPriceIndex(prices, [], [tx]), fx: buildFxTable([]),
      userCurrency: "EUR", period: "max", today: TODAY,
    })!;
    expect(returns.moneyWeighted!).toBeCloseTo(returns.twr!, 9);
  });

  it("uno split con prezzi divisi non cambia valore né rendimento", () => {
    const { transactions, closes } = closePriceScenario(7);
    const splitDay = "2025-06-02";
    const ratio = 4;
    const splitTransactions = [
      ...transactions.map((t) =>
        t.date >= splitDay ? { ...t, quantity: String(Number(t.quantity) * ratio), price: String(Number(t.price) / ratio) } : t
      ),
      { id: "split", instrumentId: "etf", type: "split" as const, date: splitDay, quantity: String(ratio), price: "0", fxRate: "1", fees: "0", taxes: "0", grossAmount: null },
    ];
    const splitPrices = [...closes.entries()].map(([date, close]) => ({
      instrumentId: "etf", date, close: String(date >= splitDay ? close / ratio : close), source: "yahoo" as const,
    }));
    const plainPrices = [...closes.entries()].map(([date, close]) => ({ instrumentId: "etf", date, close: String(close), source: "yahoo" as const }));
    const run = (txs: InvestmentTransactionInput[], prices: PriceInput[]) => {
      const common = { transactions: txs, instruments: [ETF], priceIndex: buildPriceIndex(prices, [], txs), fx: buildFxTable([]), userCurrency: "EUR" };
      return {
        summary: computePortfolioSummary({ ...common, todayKey: TODAY_KEY }),
        returns: computePortfolioReturns({ ...common, period: "max", today: TODAY })!,
      };
    };
    const plain = run(transactions, plainPrices);
    const split = run(splitTransactions, splitPrices);
    expect(split.summary.totalValue).toBeCloseTo(plain.summary.totalValue, 6);
    expect(split.summary.totalGain).toBeCloseTo(plain.summary.totalGain, 6);
    expect(split.summary.costBasis).toBeCloseTo(plain.summary.costBasis, 6);
    expect(split.returns.twr!).toBeCloseTo(plain.returns.twr!, 9);
    expect(split.returns.moneyWeighted!).toBeCloseTo(plain.returns.moneyWeighted!, 9);
  });
});
