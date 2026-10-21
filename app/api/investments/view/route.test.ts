import { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instrumentPrices, instruments, investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
import { investmentsIncomeSchema, investmentsPerformanceSchema, investmentsTaxesSchema, investmentsViewSchema, saleSimulationSchema } from "@/lib/views";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
// No market downloads from tests.
vi.mock("@/lib/market-data/runtime", () => ({ ensureProfilesSafely: vi.fn(), ensureDividendsSafely: vi.fn() }));

import { auth } from "@/lib/auth";
import { GET as getView } from "./route";
import { GET as getPerformance } from "../performance/route";
import { GET as getIncome } from "../income/route";
import { GET as getTaxes } from "../taxes/route";
import { POST as simulate } from "../taxes/simulate-sale/route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const url = (path: string) => new NextRequest(`http://localhost/api/investments/${path}`);
const post = (body: unknown, query = "today=2026-10-18") =>
  simulate(new NextRequest(`http://localhost/api/investments/taxes/simulate-sale?${query}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

/** Weekday closes from 2026-07-01 to 2026-10-16, rising 0.1% a day from 100. */
function closes(instrumentId: string) {
  const rows: { instrumentId: string; date: string; close: string; source: "yahoo" }[] = [];
  let price = 100;
  for (let d = new Date(Date.UTC(2026, 6, 1)); d <= new Date(Date.UTC(2026, 9, 16)); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    price *= 1.001;
    rows.push({ instrumentId, date: d.toISOString().slice(0, 10), close: price.toFixed(4), source: "yahoo" });
  }
  return rows;
}

describe("investments views: view, performance, income, taxes, simulate-sale", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let userId: string;
  let instrumentId: string;

  beforeEach(async () => {
    userId = `test-inv-views-${crypto.randomUUID()}`;
    userIds.push(userId);
    await db.insert(authUser).values({ id: userId, name: "T", email: `${userId}@example.com`, emailVerified: true, currency: "EUR", language: "en", productCountry: "IT" });
    mockedGetSession.mockResolvedValue({ user: { id: userId, currency: "EUR", language: "en", productCountry: "IT" } } as never);
    const [instrument] = await db.insert(instruments).values({ name: "Test Stock", type: "azione", currency: "EUR", priceMode: "auto" }).returning();
    instrumentId = instrument.id;
    instrumentIds.push(instrumentId);
    await db.insert(instrumentPrices).values(closes(instrumentId));
    const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: "P" }).returning();
    await db.insert(investmentTransactions).values([
      { userId, portfolioId: portfolio.id, instrumentId, type: "acquisto", date: "2026-07-01", quantity: "10", price: "100", fxRate: "1", fees: "2", taxes: "0" },
      { userId, portfolioId: portfolio.id, instrumentId, type: "dividendo", date: "2026-09-15", quantity: "0", price: "0", fxRate: "1", fees: "0", taxes: "2.6", grossAmount: "10" },
    ]);
  });

  afterEach(async () => {
    await db.delete(investmentPortfolios).where(inArray(investmentPortfolios.userId, userIds));
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
  });

  it("require a session", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await getView(url("view"))).status).toBe(401);
  });

  it("view: positions, breakdown, cost scenarios and operations", async () => {
    const response = await getView(url("view?period=3mesi&today=2026-10-18"));
    expect(response.status).toBe(200);
    const view = investmentsViewSchema.parse(await response.json());
    expect(view.summary.rows).toHaveLength(1);
    expect(view.summary.rows[0]).toMatchObject({ quantity: 10 });
    expect(view.breakdown.paid).toBeCloseTo(view.summary.rows[0]!.costBasis);
    expect(view.concentration).toMatchObject({ kind: "single", name: "Test Stock" });
    expect(view.costScenarios.map((s) => s.series.length)).toEqual([view.series.length, view.series.length, view.series.length, view.series.length]);
    expect(view.costScenarios.find((s) => s.includeFees && s.includeTaxes)?.active).toBe(false);
    expect(view.brokers).toEqual([expect.objectContaining({ id: "manual", excluded: false, operations: 2 })]);
    expect(view.operationYears).toEqual([2026]);
    expect(view.income.count).toBe(1);
  });

  it("view: excluding the only broker leaves an empty portfolio, the broker stays listed", async () => {
    const view = investmentsViewSchema.parse(await (await getView(url("view?excludeBrokers=manual&today=2026-10-18"))).json());
    expect(view).toMatchObject({ hasTransactions: false, brokers: [expect.objectContaining({ id: "manual", excluded: true })] });
  });

  it("performance: returns, one inspect point per chart point, heatmaps", async () => {
    const response = await getPerformance(url("performance?period=1mese&today=2026-10-18"));
    expect(response.status).toBe(200);
    const perf = investmentsPerformanceSchema.parse(await response.json());
    expect(perf.returns?.twr).toBeGreaterThan(0);
    expect(perf.inspect).toHaveLength(perf.returns!.series.length);
    expect(perf.inspect.at(-1)).toMatchObject({ twr: perf.returns!.twr, toKey: perf.returns!.toKey });
    expect(perf.heatmaps.mese?.grouping).toBe("mese");
    expect(perf.risk?.level).not.toBeUndefined();
  });

  it("performance: a custom range needs valid bounds", async () => {
    expect(await (await getPerformance(url("performance?period=custom&today=2026-10-18"))).json()).toMatchObject({ code: "invalid_date_range" });
    expect(await (await getPerformance(url("performance?period=custom&from=2026-09-01&to=2026-12-01&today=2026-10-18"))).json()).toMatchObject({ code: "invalid_date_range" });
    const perf = investmentsPerformanceSchema.parse(await (await getPerformance(url("performance?period=custom&from=2026-09-01&to=2026-10-16&today=2026-10-18"))).json());
    expect(perf).toMatchObject({ calculationPeriod: "max", range: { from: "2026-09-01", to: "2026-10-16" } });
    expect(await (await getPerformance(url("performance?period=week"))).json()).toMatchObject({ code: "invalid_period" });
  });

  it("income and taxes (Italy)", async () => {
    const income = investmentsIncomeSchema.parse(await (await getIncome(url("income?today=2026-10-18"))).json());
    expect(income.history).toMatchObject({ count: 1 });
    expect(income.byMonth[0]).toMatchObject({ year: 2026, gross: 10, withheld: 2.6 });
    const taxes = investmentsTaxesSchema.parse(await (await getTaxes(url("taxes?today=2026-10-18"))).json());
    expect(taxes).toMatchObject({ regime: "amministrato", currentYear: 2026, rateListInstrumentIds: [instrumentId] });
    expect(taxes.sellable).toEqual([expect.objectContaining({ quantity: 10, fxRate: 1 })]);
  });

  it("simulate-sale: tax on the gain, quantity clamped to what is held, no writes", async () => {
    const response = await post({ instrumentId, quantity: 50 });
    expect(response.status).toBe(200);
    const result = saleSimulationSchema.parse(await response.json());
    expect(result).toMatchObject({ quantity: 10, heldQuantity: 10, category: "diversi", regime: "amministrato", taxLineLabel: "Withholding taxes" });
    expect(result.gain).toBeGreaterThan(0);
    expect(result.taxDelta).toBeCloseTo(result.gain * 0.26, 6);
    const custom = saleSimulationSchema.parse(await (await post({ instrumentId, quantity: 1, price: 90 })).json());
    expect(custom.gain).toBeLessThan(0);
    const rows = await db.select().from(investmentTransactions).where(inArray(investmentTransactions.userId, [userId]));
    expect(rows).toHaveLength(2);
  });

  it("simulate-sale: coded errors", async () => {
    expect(await (await post({ instrumentId: crypto.randomUUID(), quantity: 1 })).json()).toMatchObject({ code: "position_not_sellable" });
    expect(await (await post({ instrumentId, quantity: 0 })).json()).toMatchObject({ code: "validation_failed", field: "quantity" });
  });

  it("income, taxes and simulate-sale are Italy only: 403 country_feature_unavailable in Germany", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: userId, currency: "EUR", language: "en", productCountry: "DE" } } as never);
    for (const response of [await getIncome(url("income")), await getTaxes(url("taxes")), await post({ instrumentId, quantity: 1 })]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "country_feature_unavailable" });
    }
    expect((await getView(url("view?today=2026-10-18"))).status).toBe(200);
  });
});
