import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  fxRates,
  instrumentPrices,
  instrumentSymbols,
  instruments,
  investmentPortfolios,
  investmentTransactions,
  type Instrument,
} from "@/lib/db/schema/investments";
import { createMemoryBudgetStore } from "./budget";
import { ProviderError } from "./errors";
import type { DailyClose, FxProvider, PriceProvider, ProviderId } from "./types";
import { backfillInstrument, updateHeldInstruments, type MarketDataDeps } from "./update";

// Valuta di test ISO 4217: nessun dato reale la usa, così le righe di cambio si ripuliscono senza rischi.
const TEST_CURRENCY = "XTS";
const TODAY = new Date("2026-09-28T20:00:00Z");

function fake(id: ProviderId, closes: () => DailyClose[] | Promise<DailyClose[]>, extra: Partial<PriceProvider> = {}) {
  const provider: PriceProvider & { calls: number } = {
    id,
    requiredKeyEnv: null,
    maxHistory: "unlimited",
    minDelayMs: 0,
    calls: 0,
    async fetchDailyCloses() {
      provider.calls += 1;
      return closes();
    },
    ...extra,
  };
  return provider;
}

const xts = (date: string, close: number): DailyClose => ({ date, close, currency: TEST_CURRENCY });

describe("aggiornamento prezzi", () => {
  let userId: string;
  let instrument: Instrument;

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-market-update-${crypto.randomUUID()}`,
        name: "Test Prezzi",
        email: `test-market-update-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
      })
      .returning();
    userId = user.id;
    [instrument] = await db
      .insert(instruments)
      .values({ name: "ETF di test", type: "etf", currency: TEST_CURRENCY, createdByUserId: userId })
      .returning();
    await db.insert(instrumentSymbols).values({ instrumentId: instrument.id, provider: "yahoo", symbol: "TEST.DE" });
    const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: "Portafoglio" }).returning();
    await db.insert(investmentTransactions).values({
      userId,
      portfolioId: portfolio.id,
      instrumentId: instrument.id,
      type: "acquisto",
      date: "2026-01-10",
      quantity: "10",
      price: "100",
    });
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(instruments).where(eq(instruments.id, instrument.id));
    await db.delete(fxRates).where(eq(fxRates.currency, TEST_CURRENCY));
  });

  afterAll(async () => {
    await client.end();
  });

  function deps(providers: Partial<Record<ProviderId, PriceProvider>>, fxProviders: FxProvider[] = []): MarketDataDeps {
    return {
      ctx: { fetch: vi.fn(), env: {} },
      budget: createMemoryBudgetStore(),
      providers,
      fxProviders,
      log: { debug() {}, info() {}, warn() {}, error() {}, child() { return this; } },
      sleep: async () => {},
    };
  }

  async function prices() {
    return db
      .select({ date: instrumentPrices.date, close: instrumentPrices.close, source: instrumentPrices.source })
      .from(instrumentPrices)
      .where(eq(instrumentPrices.instrumentId, instrument.id))
      .orderBy(instrumentPrices.date);
  }

  it("usa la riserva quando la prima fonte fallisce e salva la fonte usata", async () => {
    const yahoo = fake("yahoo", () => {
      throw new ProviderError("yahoo", "boom");
    });
    const stooq = fake("stooq", () => [xts("2026-09-25", 101), xts("2026-09-26", 102)]);
    const summary = await updateHeldInstruments(TODAY, deps({ yahoo, stooq }));
    expect(summary.updated).toBeGreaterThanOrEqual(1);
    expect(summary.fromFallback).toBeGreaterThanOrEqual(1);
    expect(await prices()).toEqual([
      { date: "2026-09-25", close: "101.00000000", source: "stooq" },
      { date: "2026-09-26", close: "102.00000000", source: "stooq" },
    ]);
    // Il simbolo Stooq è stato derivato da quello Yahoo e salvato.
    const symbols = await db
      .select({ provider: instrumentSymbols.provider, symbol: instrumentSymbols.symbol })
      .from(instrumentSymbols)
      .where(and(eq(instrumentSymbols.instrumentId, instrument.id), eq(instrumentSymbols.provider, "stooq")));
    expect(symbols).toEqual([{ provider: "stooq", symbol: "test.de" }]);
  });

  it("l'aggiornamento giornaliero sostituisce il valore di un giorno già salvato", async () => {
    let close = 100;
    const yahoo = fake("yahoo", () => [xts("2026-09-26", close)]);
    await updateHeldInstruments(TODAY, deps({ yahoo }));
    close = 105;
    await updateHeldInstruments(TODAY, deps({ yahoo }));
    expect((await prices()).map((p) => p.close)).toEqual(["105.00000000"]);
  });

  it("ignora gli strumenti venduti del tutto", async () => {
    const [portfolio] = await db.select().from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId));
    await db.insert(investmentTransactions).values({
      userId,
      portfolioId: portfolio.id,
      instrumentId: instrument.id,
      type: "vendita",
      date: "2026-02-10",
      quantity: "10",
      price: "110",
    });
    const yahoo = fake("yahoo", () => [xts("2026-09-26", 100)]);
    await updateHeldInstruments(TODAY, deps({ yahoo }));
    expect(await prices()).toEqual([]);
  });

  it("aggiorna i cambi delle valute degli strumenti posseduti, con la riserva se la prima fonte fallisce", async () => {
    const failing: FxProvider = {
      id: "ecb",
      async fetchRates() {
        throw new ProviderError("ecb", "boom");
      },
    };
    const backup: FxProvider = {
      id: "frankfurter",
      async fetchRates(currencies) {
        return currencies.includes(TEST_CURRENCY) ? [{ date: "2026-09-26", currency: TEST_CURRENCY, perEur: 2 }] : [];
      },
    };
    const yahoo = fake("yahoo", () => [xts("2026-09-26", 100)]);
    await updateHeldInstruments(TODAY, deps({ yahoo }, [failing, backup]));
    const rates = await db.select().from(fxRates).where(eq(fxRates.currency, TEST_CURRENCY));
    expect(rates.map((r) => [r.date, r.perEur, r.source])).toEqual([["2026-09-26", "2.00000000", "frankfurter"]]);
  });

  it("il recupero storico usa solo fonti senza limiti e non tocca i giorni già salvati", async () => {
    await db.insert(instrumentPrices).values({ instrumentId: instrument.id, date: "2026-01-12", close: "99", source: "yahoo" });
    const alphavantage = fake("alphavantage", () => [xts("2026-01-12", 1)], { maxHistory: "limited" });
    const yahoo = fake("yahoo", () => [xts("2026-01-12", 50), xts("2026-01-13", 51)]);
    await db.insert(instrumentSymbols).values({ instrumentId: instrument.id, provider: "alphavantage", symbol: "TEST.DEX" });
    const progress = vi.fn();
    const result = await backfillInstrument(instrument, "2026-01-10", TODAY, deps({ alphavantage, yahoo }), progress);
    expect(alphavantage.calls).toBe(0);
    expect(result.source).toBe("yahoo");
    expect(progress).toHaveBeenCalledWith(2, 2);
    expect((await prices()).map((p) => [p.date, p.close])).toEqual([
      ["2026-01-12", "99.00000000"],
      ["2026-01-13", "51.00000000"],
    ]);
  });

  it("senza nessuna fonte disponibile non salva nulla e conta il fallimento", async () => {
    const summary = await updateHeldInstruments(TODAY, deps({}));
    expect(summary.failed).toBeGreaterThanOrEqual(1);
    expect(await prices()).toEqual([]);
    // Nessuna riga orfana di altri test.
    expect(await db.select().from(instrumentPrices).where(inArray(instrumentPrices.instrumentId, [instrument.id]))).toEqual([]);
  });
});
