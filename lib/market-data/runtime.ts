import "server-only";
import type { Instrument } from "@/lib/db/schema/investments";
import { logger } from "@/lib/observability";
import { browserTlsFetch } from "./browser-fetch";
import {
  FAKE_FX_PROVIDER,
  FAKE_INFLATION_PROVIDER,
  FAKE_PRICE_PROVIDERS,
  FAKE_DIVIDEND_PROVIDER,
  FAKE_FUNDAMENTALS_PROVIDER,
  FAKE_PROFILE_PROVIDER,
  FAKE_RATE_PROVIDER,
  fakeCryptoSearch,
  fakeListings,
  fakeQuoteMeta,
  fakeSearch,
  isFakeMarketData,
} from "./fake";
import { refreshCryptoCatalog, searchCryptoCached } from "./crypto-catalog";
import { fetchOpenFigiListings, fetchYahooQuoteMeta, searchYahoo, setYahooSessionStore, type YahooQuoteMeta, type YahooSearchHit } from "./providers";
import {
  getCachedYahooSearch,
  redisBackfillStore,
  redisBudgetStore,
  redisCryptoCatalogStore,
  redisYahooSessionStore,
  setCachedYahooSearch,
} from "./redis-stores";
import { findInstrumentsWithoutProfile, PROFILE_ON_DEMAND_LIMIT, refreshInstrumentProfile } from "./profiles";
import { redis } from "@/lib/redis/client";
import { searchByIsinOnOpenFigi } from "@/lib/investments/isin-listings";
import { DIVIDENDS_ON_DEMAND_LIMIT, findInstrumentsWithoutDividends, refreshInstrumentDividends } from "./dividends";
import { loadFundamentals, loadStatements } from "./fundamentals";
import { loadSymbols } from "./store";
import type { ProviderContext } from "./types";
import { backfillInstrument, type MarketDataDeps } from "./update";
import type { BackfillStore } from "./backfill-state";

/**
 * Store of the backfill state. In production it is the Redis one; tests can replace it to check that a backfill
 * starts and finishes without touching Redis.
 */
let backfillStore: BackfillStore | null = null;

/** Store of the backfill state in use (Redis, unless it has been replaced). */
export function getBackfillStore(): BackfillStore {
  if (!backfillStore) backfillStore = redisBackfillStore;
  return backfillStore;
}

/** Replaces the store of the backfill state; `null` restores the Redis one. */
export function setBackfillStore(store: BackfillStore | null): void {
  backfillStore = store;
}

// Sessione Yahoo condivisa su Redis tra i pod, invece che in memoria per processo (vedi yahoo.ts).
setYahooSessionStore(redisYahooSessionStore);

/** Contesto reale delle fonti: `fetch` con TLS da browser (vedi browser-fetch.ts) e variabili d'ambiente del processo. */
function realContext(): ProviderContext {
  return { fetch: browserTlsFetch, env: process.env };
}

/** Dipendenze dell'aggiornamento prezzi: fonti vere, o finte con `MARKET_DATA_FAKE=1` fuori produzione. */
export function marketDataDeps(): MarketDataDeps {
  const base = { ctx: realContext(), budget: redisBudgetStore };
  return isFakeMarketData()
    ? {
        ...base,
        providers: FAKE_PRICE_PROVIDERS,
        fxProviders: [FAKE_FX_PROVIDER],
        inflationProvider: FAKE_INFLATION_PROVIDER,
        rateProvider: FAKE_RATE_PROVIDER,
        profileProvider: FAKE_PROFILE_PROVIDER,
        dividendProvider: FAKE_DIVIDEND_PROVIDER,
        fundamentalsProvider: FAKE_FUNDAMENTALS_PROVIDER,
      }
    : base;
}

/** Ricerca strumenti su Yahoo (o sul catalogo finto). */
export async function searchInstrumentsOnProviders(query: string): Promise<YahooSearchHit[]> {
  if (isFakeMarketData()) return fakeSearch(query);
  const cached = await getCachedYahooSearch<YahooSearchHit[]>(query).catch(() => null);
  if (cached !== null) return cached;
  const hits = await searchYahoo(query, realContext());
  await setCachedYahooSearch(query, hits).catch(() => undefined);
  return hits;
}

/** Ricerca crypto nel catalogo locale, con CoinGecko solo per le rare fuori catalogo (o sull'elenco finto). */
export async function searchCryptoOnProviders(query: string): Promise<{ id: string; name: string; symbol: string }[]> {
  return isFakeMarketData() ? fakeCryptoSearch(query) : searchCryptoCached(query, realContext(), redisCryptoCatalogStore);
}

/** Rinnova il catalogo crypto locale (cron serale); con le fonti finte non fa nulla. */
export async function refreshCryptoCatalogOnProviders(): Promise<number> {
  if (isFakeMarketData()) return 0;
  return (await refreshCryptoCatalog(realContext(), redisCryptoCatalogStore)).length;
}

/** Valuta e borsa di un simbolo Yahoo, o null se Yahoo non lo conosce. */
export async function quoteMetaOnProviders(symbol: string): Promise<YahooQuoteMeta | null> {
  return isFakeMarketData() ? fakeQuoteMeta(symbol) : fetchYahooQuoteMeta(symbol, realContext());
}

/** Giorni di storico chiesti alla creazione di uno strumento, prima che ci siano operazioni. */
export const INITIAL_HISTORY_DAYS = 30;

/**
 * Starts in the background the history backfill from `fromKey` to today (`auto` instruments).
 * `schedule` is Next.js `after()` in routes. Returns true when a backfill started now.
 *
 * This does not look at what is already stored: a backfill starts unless the interval has been asked for
 * recently, not when the history looks complete. The caller knows which interval it needs (an operation, the
 * period of a chart) and uses `historyCovers()` from `@/lib/investments/history` to avoid asking needlessly.
 * Closes already saved are not touched (see `backfillInstrument`), so running it again is safe.
 */
export async function ensureHistory(
  instrument: Instrument,
  fromKey: string,
  schedule: (task: () => Promise<void>) => void
): Promise<boolean> {
  if (instrument.priceMode !== "auto") return false;
  const store = getBackfillStore();
  if (!(await store.tryStart(instrument.id, fromKey))) return false;

  schedule(async () => {
    let saved = 0;
    try {
      const result = await backfillInstrument(instrument, fromKey, new Date(), marketDataDeps(), (done, total) => {
        saved = done;
        void store.progress(instrument.id, done, total);
      });
      await store.finish(instrument.id, result.source ? "done" : "failed", result.saved);
    } catch (error) {
      logger.error("market.backfill.failed", { error });
      await store.finish(instrument.id, "failed", saved);
    }
  });
  return true;
}

/** Un tentativo di profilo su richiesta per strumento ogni ora: evita di richiedere a ogni caricamento della pagina. */
const PROFILE_ATTEMPT_TTL_SECONDS = 60 * 60;

/**
 * Scarica in background i profili (settori, area, primi titoli) degli strumenti che non ne hanno ancora uno, al
 * massimo `PROFILE_ON_DEMAND_LIMIT` per volta. Non lancia mai: un errore resta nei log.
 */
export async function ensureProfilesSafely(instruments: Instrument[], schedule: (task: () => Promise<void>) => void): Promise<void> {
  try {
    const missing = await findInstrumentsWithoutProfile(instruments);
    const toFetch: Instrument[] = [];
    for (const instrument of missing) {
      if (toFetch.length >= PROFILE_ON_DEMAND_LIMIT) break;
      const acquired = await redis.set(`market:profile-attempt:${instrument.id}`, "1", "EX", PROFILE_ATTEMPT_TTL_SECONDS, "NX");
      if (acquired === "OK") toFetch.push(instrument);
    }
    if (toFetch.length === 0) return;
    schedule(async () => {
      const deps = marketDataDeps();
      const symbols = await loadSymbols(toFetch.map((i) => i.id));
      for (const instrument of toFetch) {
        await refreshInstrumentProfile(instrument, symbols.get(instrument.id)?.yahoo ?? null, deps.ctx, { provider: deps.profileProvider });
      }
    });
  } catch (error) {
    logger.warn("market.profiles.failed", { error });
  }
}

/**
 * Scarica in background lo storico dividendi degli strumenti mai scaricati, al massimo `DIVIDENDS_ON_DEMAND_LIMIT`
 * per volta e un tentativo all'ora per strumento. Non lancia mai: un errore resta nei log.
 */
export async function ensureDividendsSafely(instruments: Instrument[], schedule: (task: () => Promise<void>) => void): Promise<void> {
  try {
    const missing = await findInstrumentsWithoutDividends(instruments);
    const toFetch: Instrument[] = [];
    for (const instrument of missing) {
      if (toFetch.length >= DIVIDENDS_ON_DEMAND_LIMIT) break;
      const acquired = await redis.set(`market:dividends-attempt:${instrument.id}`, "1", "EX", PROFILE_ATTEMPT_TTL_SECONDS, "NX");
      if (acquired === "OK") toFetch.push(instrument);
    }
    if (toFetch.length === 0) return;
    schedule(async () => {
      const deps = marketDataDeps();
      const symbols = await loadSymbols(toFetch.map((i) => i.id));
      for (const instrument of toFetch) {
        await refreshInstrumentDividends(instrument, symbols.get(instrument.id)?.yahoo ?? null, deps.ctx, { provider: deps.dividendProvider });
      }
    });
  } catch (error) {
    logger.warn("market.dividends.failed", { error });
  }
}

/** Numeri chiave di uno strumento (Yahoo, o finti con `MARKET_DATA_FAKE=1`), con cache giornaliera su Redis. */
export function fundamentalsOnProviders(instrument: Pick<Instrument, "id" | "type" | "priceMode">) {
  const deps = marketDataDeps();
  return loadFundamentals(instrument, deps.ctx, { provider: deps.fundamentalsProvider });
}

/** Bilanci di un'azione (Yahoo, o finti con `MARKET_DATA_FAKE=1`), con cache giornaliera su Redis. */
export function statementsOnProviders(instrument: Pick<Instrument, "id" | "type" | "priceMode">) {
  const deps = marketDataDeps();
  return loadStatements(instrument, deps.ctx, { provider: deps.fundamentalsProvider });
}

/** Quotazioni di un ISIN su OpenFIGI (finte con `MARKET_DATA_FAKE=1`). Usa il `fetch` normale: non serve il TLS da browser. */
export async function listingsOnOpenFigi(isin: string) {
  if (isFakeMarketData()) return fakeListings();
  return fetchOpenFigiListings(isin, { fetch: globalThis.fetch, env: process.env });
}

/** ISIN listings on OpenFIGI confirmed on Yahoo; `preferredExchange` (an OpenFIGI code, e.g. the broker's) comes first. */
export async function searchByIsinOnProviders(isin: string, currency: string | null, preferredExchange: string | null = null) {
  return searchByIsinOnOpenFigi(isin, currency, { listings: listingsOnOpenFigi, quoteMeta: quoteMetaOnProviders }, preferredExchange);
}
