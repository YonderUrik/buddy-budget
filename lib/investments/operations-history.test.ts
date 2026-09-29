import { describe, expect, it } from "vitest";
import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex, computePortfolioSummary, type InvestmentTransactionInput } from "@/lib/calc/investments";
import {
  computeOperationInsights,
  formatMonthLabel,
  groupOperationsByMonth,
  operationYears,
  sumOperationTotals,
} from "./operations-history";

const ETF = { id: "etf", name: "VWCE", type: "etf" as const, currency: "EUR", priceUnit: "unita" as const };
const USD = { id: "aapl", name: "Apple", type: "azione" as const, currency: "USD", priceUnit: "unita" as const };
const TODAY = "2026-09-20";

function op(partial: Partial<InvestmentTransactionInput> & Pick<InvestmentTransactionInput, "id" | "type" | "date">) {
  return {
    instrumentId: "etf",
    quantity: "0",
    price: "0",
    fxRate: "1",
    fees: "0",
    taxes: "0",
    grossAmount: null,
    ...partial,
  };
}

function run(transactions: InvestmentTransactionInput[], closes: { instrumentId: string; date: string; close: string }[]) {
  const params = {
    transactions,
    instruments: [ETF, USD],
    priceIndex: buildPriceIndex(
      closes.map((c) => ({ ...c, source: "yahoo" as const })),
      [],
      transactions
    ),
    fx: buildFxTable([{ date: "2026-09-01", currency: "USD", perEur: "1.25" }]),
    userCurrency: "EUR",
    todayKey: TODAY,
  };
  return { params, insights: computeOperationInsights(params) };
}

describe("computeOperationInsights", () => {
  it("misura ogni acquisto al prezzo di oggi, commissioni incluse", () => {
    const { insights } = run(
      [
        op({ id: "a", type: "acquisto", date: "2026-01-10", quantity: "10", price: "100", fees: "5" }),
        op({ id: "b", type: "acquisto", date: "2026-03-10", quantity: "10", price: "120" }),
      ],
      [{ instrumentId: "etf", date: "2026-09-19", close: "130" }]
    );
    const [a, b] = insights;
    expect(a.paid).toBe(1005);
    expect(a.currentValue).toBe(1300);
    expect(a.gain).toBe(295);
    expect(a.gainPct).toBeCloseTo(295 / 1005);
    expect(b.gain).toBe(100);
  });

  it("una vendita realizza sul costo medio e riduce in proporzione gli acquisti aperti", () => {
    const { params, insights } = run(
      [
        op({ id: "a", type: "acquisto", date: "2026-01-10", quantity: "10", price: "100" }),
        op({ id: "b", type: "acquisto", date: "2026-02-10", quantity: "10", price: "200" }),
        op({ id: "s", type: "vendita", date: "2026-03-10", quantity: "10", price: "180", fees: "2" }),
        op({ id: "d", type: "dividendo", date: "2026-04-10", grossAmount: "20", taxes: "5.2" }),
      ],
      [{ instrumentId: "etf", date: "2026-09-19", close: "160" }]
    );
    const [a, b, sale, dividend] = insights;
    expect(sale.received).toBe(1798);
    expect(sale.gainBase).toBe(1500);
    expect(sale.gain).toBe(298);
    expect(a.remainingQuantity).toBe(5);
    expect(b.remainingQuantity).toBe(5);
    expect(a.gain).toBe(800 - 500);
    expect(b.gain).toBe(800 - 1000);
    expect(dividend.gain).toBeCloseTo(14.8);
    expect(dividend.gainPct).toBeNull();

    // La somma dei guadagni per operazione è il guadagno complessivo del portafoglio.
    const summary = computePortfolioSummary(params);
    expect(sumOperationTotals(insights).gain).toBeCloseTo(summary.totalGain);
  });

  it("un acquisto del tutto venduto non ha un guadagno proprio", () => {
    const { insights } = run(
      [
        op({ id: "a", type: "acquisto", date: "2026-01-10", quantity: "3", price: "100" }),
        op({ id: "s", type: "vendita", date: "2026-02-10", quantity: "3", price: "110" }),
      ],
      [{ instrumentId: "etf", date: "2026-09-19", close: "150" }]
    );
    expect(insights[0].remainingQuantity).toBe(0);
    expect(insights[0].gain).toBeNull();
    expect(sumOperationTotals(insights).unpricedCount).toBe(0);
    expect(sumOperationTotals(insights).gain).toBe(30);
  });

  it("converte nella valuta utente con il cambio di oggi", () => {
    const { insights } = run(
      [op({ id: "a", instrumentId: "aapl", type: "acquisto", date: "2026-05-10", quantity: "2", price: "100", fxRate: "0.8" })],
      [{ instrumentId: "aapl", date: "2026-09-19", close: "125" }]
    );
    expect(insights[0].paid).toBe(160);
    expect(insights[0].currentValue).toBe(200);
    expect(insights[0].gain).toBe(40);
  });

  it("senza cambio l'acquisto resta senza guadagno e viene contato come non prezzato", () => {
    const { insights } = run(
      [op({ id: "a", instrumentId: "aapl", type: "acquisto", date: "2026-05-10", quantity: "2", price: "100" })],
      []
    );
    const noFx = computeOperationInsights({
      transactions: insights.map((i) => i.transaction),
      instruments: [USD],
      priceIndex: buildPriceIndex([], [], insights.map((i) => i.transaction)),
      fx: buildFxTable([]),
      userCurrency: "EUR",
      todayKey: TODAY,
    });
    expect(noFx[0].gain).toBeNull();
    expect(sumOperationTotals(noFx).unpricedCount).toBe(1);
  });
});

describe("split nella lista operazioni", () => {
  it("un acquisto prima di uno split si misura sulle quote moltiplicate, e i totali coincidono col portafoglio", () => {
    const transactions = [
      op({ id: "a", type: "acquisto", date: "2026-01-10", quantity: "10", price: "100" }),
      op({ id: "s", type: "split", date: "2026-02-01", quantity: "2" }),
      op({ id: "v", type: "vendita", date: "2026-03-01", quantity: "5", price: "60" }),
    ];
    const { params, insights } = run(transactions, [{ instrumentId: "etf", date: TODAY, close: "70" }]);
    const buy = insights.find((i) => i.transaction.id === "a")!;
    expect(buy.remainingQuantity).toBeCloseTo(15);
    expect(buy.gainBase).toBeCloseTo(750);
    expect(buy.currentValue).toBeCloseTo(1050);
    const sell = insights.find((i) => i.transaction.id === "v")!;
    expect(sell.gain).toBeCloseTo(50);
    const split = insights.find((i) => i.transaction.id === "s")!;
    expect(split.gain).toBeNull();
    const totals = sumOperationTotals(insights);
    expect(totals.bought).toBeCloseTo(1000);
    expect(totals.gain).toBeCloseTo(computePortfolioSummary(params).totalGain);
  });
});

describe("groupOperationsByMonth", () => {
  it("raggruppa per mese dal più recente, con totali e anni", () => {
    const { insights } = run(
      [
        op({ id: "a", type: "acquisto", date: "2025-12-03", quantity: "1", price: "100" }),
        op({ id: "b", type: "acquisto", date: "2026-01-05", quantity: "1", price: "110" }),
        op({ id: "c", type: "acquisto", date: "2026-01-20", quantity: "1", price: "120" }),
      ],
      [{ instrumentId: "etf", date: "2026-09-19", close: "130" }]
    );
    const months = groupOperationsByMonth(insights);
    expect(months.map((m) => m.key)).toEqual(["2026-01", "2025-12"]);
    expect(months[0].label).toBe("Gennaio 2026");
    expect(months[0].operations.map((o) => o.transaction.id)).toEqual(["c", "b"]);
    expect(months[0].totals).toMatchObject({ count: 2, bought: 230, gain: 30 });
    expect(operationYears(months)).toEqual([2026, 2025]);
  });

  it("formatta il nome del mese con l'anno", () => {
    expect(formatMonthLabel("2026-09")).toBe("Settembre 2026");
  });
});
