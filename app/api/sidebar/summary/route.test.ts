import { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  instrumentPrices,
  instrumentSymbols,
  instruments,
  investmentPortfolios,
  investmentTransactions,
  userPriceAlerts,
  userWatchlistItems,
} from "@/lib/db/schema/investments";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const get = () => GET(new NextRequest("http://localhost/api/sidebar/summary"));
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe("GET /api/sidebar/summary", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let userId: string;

  async function createInstrument(symbol: string, prices: [number, number]) {
    const [row] = await db
      .insert(instruments)
      .values({ name: `Prova ${symbol}`, type: "azione", currency: "EUR", priceMode: "auto" })
      .returning();
    instrumentIds.push(row.id);
    await db.insert(instrumentSymbols).values({ instrumentId: row.id, provider: "yahoo", symbol: `${symbol}.MI` });
    await db.insert(instrumentPrices).values([
      { instrumentId: row.id, date: day(-1), close: String(prices[0]), source: "yahoo" },
      { instrumentId: row.id, date: day(0), close: String(prices[1]), source: "yahoo" },
    ]);
    return row.id;
  }

  beforeEach(async () => {
    userId = `test-sidebar-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: userId, name: "T", email: `${userId}@example.com`, emailVerified: false, currency: "EUR" });
    userIds.push(userId);
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
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

  it("401 senza sessione", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    expect((await get()).status).toBe(401);
  });

  it("senza dati risponde con tutto vuoto", async () => {
    const body = await (await get()).json();
    expect(body).toMatchObject({ netWorth: null, portfolio: null, watchlist: [], triggeredAlerts: 0 });
  });

  it("riassume portafoglio, watchlist e avvisi scattati; i titoli posseduti non compaiono nella watchlist", async () => {
    const held = await createInstrument("ABC", [100, 110]);
    const watched = await createInstrument("XYZ", [50, 49]);
    const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: "P" }).returning();
    await db.insert(investmentTransactions).values({
      userId, portfolioId: portfolio.id, instrumentId: held, type: "acquisto", date: day(-30), quantity: "10", price: "100", fxRate: "1", fees: "0", taxes: "0",
    });
    await db.insert(userWatchlistItems).values([{ userId, instrumentId: watched }, { userId, instrumentId: held }]);
    await db.insert(userPriceAlerts).values({ userId, instrumentId: watched, direction: "sotto", targetPrice: "49", status: "scattato" });

    const body = await (await get()).json();
    expect(body.portfolio.totalValue).toBeCloseTo(1100, 6);
    expect(body.portfolio.dayChange).toBeCloseTo(100, 6);
    expect(body.portfolio.totalGain).toBeCloseTo(100, 6);
    expect(body.portfolio.holdings).toHaveLength(1);
    expect(body.portfolio.holdings[0]).toMatchObject({ instrumentId: held, label: "ABC" });
    expect(body.watchlist).toHaveLength(1);
    expect(body.watchlist[0]).toMatchObject({ instrumentId: watched, label: "XYZ", lastClose: 49, triggeredAlerts: 1 });
    expect(body.triggeredAlerts).toBe(1);
    expect(body.netWorth.total).toBeCloseTo(1100, 6);
  });

  it("non mostra i dati di un altro utente", async () => {
    const held = await createInstrument("ABC", [100, 110]);
    const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: "P" }).returning();
    await db.insert(investmentTransactions).values({
      userId, portfolioId: portfolio.id, instrumentId: held, type: "acquisto", date: day(-30), quantity: "10", price: "100", fxRate: "1", fees: "0", taxes: "0",
    });
    const other = `test-sidebar-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: other, name: "O", email: `${other}@example.com`, emailVerified: false, currency: "EUR" });
    userIds.push(other);
    mockedGetSession.mockResolvedValue({ user: { id: other } } as never);
    const body = await (await get()).json();
    expect(body.portfolio).toBeNull();
    expect(body.watchlist).toEqual([]);
  });
});
