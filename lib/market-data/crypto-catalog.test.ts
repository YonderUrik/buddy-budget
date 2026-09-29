import { describe, expect, it } from "vitest";
import {
  CRYPTO_CATALOG_PAGES,
  parseCryptoMarkets,
  refreshCryptoCatalog,
  searchCryptoCached,
  searchCryptoCatalog,
  type CryptoCatalogEntry,
  type CryptoCatalogStore,
  type CryptoHit,
} from "./crypto-catalog";
import { ProviderRateLimitedError } from "./errors";
import type { ProviderContext } from "./types";

const CATALOG: CryptoCatalogEntry[] = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", rank: 1 },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", rank: 2 },
  { id: "bitcoin-cash", name: "Bitcoin Cash", symbol: "BCH", rank: 20 },
  { id: "wrapped-bitcoin", name: "Wrapped Bitcoin", symbol: "WBTC", rank: 15 },
];

function memoryStore(initial: CryptoCatalogEntry[] | null = null): CryptoCatalogStore & { cooldown: boolean; searches: Map<string, CryptoHit[]> } {
  const state = { catalog: initial, cooldown: false, searches: new Map<string, CryptoHit[]>() };
  return {
    get cooldown() {
      return state.cooldown;
    },
    searches: state.searches,
    getCatalog: async () => state.catalog,
    setCatalog: async (entries) => {
      state.catalog = entries;
    },
    getSearch: async (key) => state.searches.get(key) ?? null,
    setSearch: async (key, hits) => {
      state.searches.set(key, hits);
    },
    isCoolingDown: async () => state.cooldown,
    markCoolingDown: async () => {
      state.cooldown = true;
    },
  };
}

function ctxWith(handler: (url: string) => Response): { ctx: ProviderContext; calls: string[] } {
  const calls: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return handler(String(input));
  }) as typeof fetch;
  return { ctx: { fetch: fetchFn, env: {} }, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("searchCryptoCatalog", () => {
  it("mette prima il simbolo esatto, poi il nome che inizia con la ricerca, poi per capitalizzazione", () => {
    expect(searchCryptoCatalog(CATALOG, "btc").map((c) => c.id)).toEqual(["bitcoin"]);
    expect(searchCryptoCatalog(CATALOG, "bitcoin").map((c) => c.id)).toEqual(["bitcoin", "bitcoin-cash", "wrapped-bitcoin"]);
  });

  it("ignora maiuscole e spazi e non trova nulla per una ricerca vuota o sconosciuta", () => {
    expect(searchCryptoCatalog(CATALOG, "  ETH ")[0].id).toBe("ethereum");
    expect(searchCryptoCatalog(CATALOG, "")).toEqual([]);
    expect(searchCryptoCatalog(CATALOG, "zzzz")).toEqual([]);
  });
});

describe("parseCryptoMarkets", () => {
  it("scarta le voci incomplete e maiuscolizza il simbolo", () => {
    expect(parseCryptoMarkets([{ id: "a", name: "A", symbol: "aa", market_cap_rank: 3 }, { id: "b" }])).toEqual([
      { id: "a", name: "A", symbol: "AA", rank: 3 },
    ]);
  });
});

describe("refreshCryptoCatalog", () => {
  it("scarica le pagine previste e salva il catalogo", async () => {
    const { ctx, calls } = ctxWith(() => json([{ id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1 }]));
    const store = memoryStore();
    await refreshCryptoCatalog(ctx, store, async () => undefined);
    expect(calls).toHaveLength(CRYPTO_CATALOG_PAGES);
    expect(await store.getCatalog()).toHaveLength(CRYPTO_CATALOG_PAGES);
  });
});

describe("searchCryptoCached", () => {
  it("con il catalogo presente non chiama CoinGecko", async () => {
    const { ctx, calls } = ctxWith(() => json({}));
    const hits = await searchCryptoCached("eth", ctx, memoryStore(CATALOG));
    expect(hits[0].id).toBe("ethereum");
    expect(calls).toHaveLength(0);
  });

  it("fuori catalogo chiama la ricerca una volta sola e poi risponde dalla cache, anche se vuota", async () => {
    const { ctx, calls } = ctxWith(() => json({ coins: [] }));
    const store = memoryStore(CATALOG);
    expect(await searchCryptoCached("rarissima", ctx, store)).toEqual([]);
    expect(await searchCryptoCached("Rarissima", ctx, store)).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("dopo un 429 non richiama CoinGecko finché dura la pausa", async () => {
    const { ctx, calls } = ctxWith(() => new Response(null, { status: 429 }));
    const store = memoryStore(CATALOG);
    await expect(searchCryptoCached("rarissima", ctx, store)).rejects.toBeInstanceOf(ProviderRateLimitedError);
    await expect(searchCryptoCached("altra", ctx, store)).rejects.toBeInstanceOf(ProviderRateLimitedError);
    expect(calls).toHaveLength(1);
  });

  it("senza catalogo lo scarica al primo uso e poi non lo richiede", async () => {
    const { ctx, calls } = ctxWith(() => json([{ id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1 }]));
    const store = memoryStore();
    expect((await searchCryptoCached("btc", ctx, store))[0].id).toBe("bitcoin");
    await searchCryptoCached("bitcoin", ctx, store);
    expect(calls).toHaveLength(CRYPTO_CATALOG_PAGES);
  });

  it("se il primo scaricamento è rifiutato segna la pausa e non ritenta subito", async () => {
    const { ctx, calls } = ctxWith(() => new Response(null, { status: 429 }));
    const store = memoryStore();
    await expect(searchCryptoCached("btc", ctx, store)).rejects.toBeInstanceOf(ProviderRateLimitedError);
    await expect(searchCryptoCached("btc", ctx, store)).rejects.toBeInstanceOf(ProviderRateLimitedError);
    expect(calls).toHaveLength(1);
  });
});
