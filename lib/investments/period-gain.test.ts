import { expect, it } from "vitest";
import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex, type InvestmentTransactionInput } from "@/lib/calc/investments";
import { computePeriodGain } from "./period-gain";

const buy = (id: string, date: string, price: string): InvestmentTransactionInput => ({
  id, instrumentId: "a", type: "acquisto", date, quantity: "10", price, fxRate: "1", fees: "0", taxes: "0", grossAmount: null,
});
const params = {
  transactions: [buy("1", "2026-01-01", "100"), buy("2", "2026-01-15", "120")],
  instruments: [{ id: "a", name: "Stock", type: "azione" as const, currency: "EUR", priceUnit: "unita" as const }],
  priceIndex: buildPriceIndex(
    [
      { instrumentId: "a", date: "2026-01-01", close: "100", source: "yahoo" },
      { instrumentId: "a", date: "2026-01-15", close: "120", source: "yahoo" },
      { instrumentId: "a", date: "2026-02-01", close: "130", source: "yahoo" },
    ],
    []
  ),
  fx: buildFxTable([]),
  userCurrency: "EUR",
  today: new Date("2026-02-01T12:00:00Z"),
};

it("il guadagno segue il periodo: solo la variazione dopo l'inizio, al netto dei versamenti", () => {
  const all = computePeriodGain({ ...params, period: "max" });
  expect(all?.gain).toBeCloseTo(400);
  const recent = computePeriodGain({ ...params, period: "max", range: { from: "2026-01-16", to: "2026-02-01" } });
  expect(recent?.startValue).toBeCloseTo(2400);
  expect(recent?.endValue).toBeCloseTo(2600);
  expect(recent?.netContributions).toBeCloseTo(0);
  expect(recent?.gain).toBeCloseTo(200);
  expect(recent?.twr).toBeCloseTo(2600 / 2400 - 1);
});

it("un acquisto nel periodo non è un guadagno", () => {
  const result = computePeriodGain({ ...params, period: "max", range: { from: "2026-01-10", to: "2026-02-01" } });
  expect(result?.netContributions).toBeCloseTo(1200);
  expect(result?.gain).toBeCloseTo(result!.endValue - result!.startValue - 1200);
  expect(result?.gain).toBeCloseTo(400);
});

it("senza operazioni non c'è guadagno da mostrare", () => {
  expect(computePeriodGain({ ...params, transactions: [], period: "max" })).toBeNull();
});
