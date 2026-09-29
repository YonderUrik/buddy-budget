import "server-only";
import { redis } from "@/lib/redis/client";
import { createBackfillStore } from "./backfill-state";
import type { ProviderBudgetStore } from "./budget";
import type { CryptoCatalogEntry, CryptoCatalogStore, CryptoHit } from "./crypto-catalog";
import type { YahooSessionStore } from "./providers/yahoo";

/** Budget giornaliero delle fonti a quota su Redis: condiviso tra i pod, si azzera da solo dopo due giorni. */
export const redisBudgetStore: ProviderBudgetStore = {
  async tryConsume(provider, dailyLimit, dayKey) {
    const key = `market:budget:${provider}:${dayKey}`;
    const [[, used]] = (await redis.multi().incr(key).expire(key, 2 * 24 * 60 * 60).exec()) as [[unknown, number]];
    return used <= dailyLimit;
  },
};

/** Stato dei recuperi storici su Redis. */
export const redisBackfillStore = createBackfillStore({
  get: (key) => redis.get(key),
  async set(key, value, ttlSeconds) {
    await redis.set(key, value, "EX", ttlSeconds);
  },
});

const YAHOO_SESSION_KEY = "market:yahoo:session";
const YAHOO_COOLDOWN_KEY = "market:yahoo:cooldown";

/**
 * Sessione Yahoo (cookie + crumb) e raffreddamento dopo un rifiuto, su Redis: condivisi tra i pod e sopravvivono
 * ai riavvii, invece di rinegoziare da zero a ogni redeploy/replica.
 */
export const redisYahooSessionStore: YahooSessionStore = {
  async get() {
    const raw = await redis.get(YAHOO_SESSION_KEY);
    if (raw === null) return undefined;
    return raw === "null" ? null : (JSON.parse(raw) as { cookie: string; crumb: string | null });
  },
  async set(session, ttlSeconds) {
    await redis.set(YAHOO_SESSION_KEY, session === null ? "null" : JSON.stringify(session), "EX", ttlSeconds);
  },
  async isCoolingDown() {
    return (await redis.exists(YAHOO_COOLDOWN_KEY)) === 1;
  },
  async markRefused(ttlSeconds) {
    await redis.set(YAHOO_COOLDOWN_KEY, "1", "EX", ttlSeconds);
  },
  async clear() {
    await redis.del(YAHOO_SESSION_KEY, YAHOO_COOLDOWN_KEY);
  },
};

const CRYPTO_CATALOG_KEY = "market:crypto:catalog";
const CRYPTO_SEARCH_PREFIX = "market:crypto:search:";
const CRYPTO_COOLDOWN_KEY = "market:crypto:cooldown";
/** Il catalogo dura una settimana: il cron lo rinnova ogni sera, così un cron saltato non lo svuota. */
const CRYPTO_CATALOG_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Catalogo crypto, cache delle ricerche e pausa dopo un rifiuto di CoinGecko, su Redis (condivisi tra i pod). */
export const redisCryptoCatalogStore: CryptoCatalogStore = {
  async getCatalog() {
    const raw = await redis.get(CRYPTO_CATALOG_KEY);
    return raw === null ? null : (JSON.parse(raw) as CryptoCatalogEntry[]);
  },
  async setCatalog(entries) {
    await redis.set(CRYPTO_CATALOG_KEY, JSON.stringify(entries), "EX", CRYPTO_CATALOG_TTL_SECONDS);
  },
  async getSearch(key) {
    const raw = await redis.get(`${CRYPTO_SEARCH_PREFIX}${key}`);
    return raw === null ? null : (JSON.parse(raw) as CryptoHit[]);
  },
  async setSearch(key, hits, ttlSeconds) {
    await redis.set(`${CRYPTO_SEARCH_PREFIX}${key}`, JSON.stringify(hits), "EX", ttlSeconds);
  },
  async isCoolingDown() {
    return (await redis.exists(CRYPTO_COOLDOWN_KEY)) === 1;
  },
  async markCoolingDown(ttlSeconds) {
    await redis.set(CRYPTO_COOLDOWN_KEY, "1", "EX", ttlSeconds);
  },
};

const YAHOO_SEARCH_PREFIX = "market:yahoo:search:";
/** Una ricerca su Yahoo riuscita si ricorda 6 ore: l'elenco degli strumenti quotati cambia di rado. */
export const YAHOO_SEARCH_CACHE_TTL_SECONDS = 6 * 60 * 60;

/** Risultati già ottenuti per un testo cercato su Yahoo, o null se non ci sono. */
export async function getCachedYahooSearch<T>(query: string): Promise<T | null> {
  const raw = await redis.get(`${YAHOO_SEARCH_PREFIX}${query.trim().toLowerCase()}`);
  return raw === null ? null : (JSON.parse(raw) as T);
}

/** Salva i risultati di una ricerca Yahoo riuscita. */
export async function setCachedYahooSearch(query: string, hits: unknown): Promise<void> {
  await redis.set(`${YAHOO_SEARCH_PREFIX}${query.trim().toLowerCase()}`, JSON.stringify(hits), "EX", YAHOO_SEARCH_CACHE_TTL_SECONDS);
}
