import { ProviderRateLimitedError } from "./errors";
import { providerGet, readJson } from "./http";
import { searchCoinGecko } from "./providers/coingecko";
import type { ProviderContext } from "./types";

const COINGECKO_MARKETS_URL = "https://api.coingecko.com/api/v3/coins/markets";

/** Crypto per pagina e numero di pagine scaricate: le prime 500 per capitalizzazione bastano per la ricerca. */
export const CRYPTO_CATALOG_PER_PAGE = 250;
export const CRYPTO_CATALOG_PAGES = 2;
/** Massimo di risultati restituiti da una ricerca. */
export const CRYPTO_SEARCH_LIMIT = 10;
/** Pausa tra due pagine del catalogo (stessa cautela della fonte prezzi). */
const CATALOG_PAGE_DELAY_MS = 2_500;
/** Le ricerche fuori catalogo si ricordano un giorno, anche quelle senza risultati. */
export const CRYPTO_SEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60;
/** Dopo un rifiuto di CoinGecko, pausa prima di richiamarlo dalla ricerca. */
export const CRYPTO_SEARCH_COOLDOWN_SECONDS = 2 * 60;

/** Crypto del catalogo locale; `rank` è la posizione per capitalizzazione (1 = la più grande). */
export interface CryptoCatalogEntry {
  id: string;
  name: string;
  symbol: string;
  rank: number;
}

/** Risultato della ricerca crypto (stessa forma di `searchCoinGecko`). */
export interface CryptoHit {
  id: string;
  name: string;
  symbol: string;
}

/** Dove si tengono catalogo, cache delle ricerche e pausa dopo un rifiuto: Redis in produzione, un finto nei test. */
export interface CryptoCatalogStore {
  getCatalog(): Promise<CryptoCatalogEntry[] | null>;
  setCatalog(entries: CryptoCatalogEntry[]): Promise<void>;
  getSearch(key: string): Promise<CryptoHit[] | null>;
  setSearch(key: string, hits: CryptoHit[], ttlSeconds: number): Promise<void>;
  isCoolingDown(): Promise<boolean>;
  markCoolingDown(ttlSeconds: number): Promise<void>;
}

interface MarketsRow {
  id?: string;
  name?: string;
  symbol?: string;
  market_cap_rank?: number | null;
}

/** Converte una pagina di `/coins/markets` in voci del catalogo, scartando quelle incomplete. */
export function parseCryptoMarkets(rows: MarketsRow[]): CryptoCatalogEntry[] {
  const entries: CryptoCatalogEntry[] = [];
  for (const row of rows) {
    if (!row.id || !row.name || !row.symbol) continue;
    entries.push({ id: row.id, name: row.name, symbol: row.symbol.toUpperCase(), rank: row.market_cap_rank ?? Number.MAX_SAFE_INTEGER });
  }
  return entries;
}

/** Punteggio di pertinenza (più basso = meglio) o null se la voce non corrisponde alla ricerca. */
function matchScore(entry: CryptoCatalogEntry, q: string): number | null {
  const symbol = entry.symbol.toLowerCase();
  const name = entry.name.toLowerCase();
  if (symbol === q) return 0;
  if (name === q || entry.id === q) return 1;
  if (symbol.startsWith(q)) return 2;
  if (name.startsWith(q)) return 3;
  if (name.includes(q)) return 4;
  return null;
}

/** Cerca nel catalogo per simbolo o nome: prima le corrispondenze esatte, poi per capitalizzazione. */
export function searchCryptoCatalog(entries: CryptoCatalogEntry[], query: string, limit = CRYPTO_SEARCH_LIMIT): CryptoHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return entries
    .flatMap((entry) => {
      const score = matchScore(entry, q);
      return score === null ? [] : [{ entry, score }];
    })
    .sort((a, b) => a.score - b.score || a.entry.rank - b.entry.rank)
    .slice(0, limit)
    .map(({ entry }) => ({ id: entry.id, name: entry.name, symbol: entry.symbol }));
}

/** Scarica le prime crypto per capitalizzazione (in EUR: l'ordine cambia poco tra valute) e le salva. */
export async function refreshCryptoCatalog(
  ctx: ProviderContext,
  store: CryptoCatalogStore,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<CryptoCatalogEntry[]> {
  const key = ctx.env.COINGECKO_API_KEY;
  const entries: CryptoCatalogEntry[] = [];
  for (let page = 1; page <= CRYPTO_CATALOG_PAGES; page++) {
    if (page > 1) await sleep(CATALOG_PAGE_DELAY_MS);
    const url = `${COINGECKO_MARKETS_URL}?vs_currency=eur&order=market_cap_desc&per_page=${CRYPTO_CATALOG_PER_PAGE}&page=${page}`;
    const response = await providerGet("coingecko", url, ctx, { headers: key ? { "x-cg-demo-api-key": key } : {} });
    entries.push(...parseCryptoMarkets(await readJson<MarketsRow[]>("coingecko", response!)));
  }
  if (entries.length > 0) await store.setCatalog(entries);
  return entries;
}

/**
 * Ricerca crypto senza una chiamata per battuta: prima nel catalogo locale (scaricato una volta, aggiornato dal
 * cron); solo per le crypto fuori dalle prime 500 si interroga CoinGecko, con cache di un giorno per testo cercato
 * e pausa condivisa dopo un rifiuto. Un errore di CoinGecko si propaga (la UI dice che la fonte non risponde).
 */
export async function searchCryptoCached(query: string, ctx: ProviderContext, store: CryptoCatalogStore): Promise<CryptoHit[]> {
  let catalog = await store.getCatalog();
  if (catalog === null) {
    if (await store.isCoolingDown()) throw new ProviderRateLimitedError("coingecko");
    try {
      catalog = await refreshCryptoCatalog(ctx, store);
    } catch (error) {
      if (error instanceof ProviderRateLimitedError) await store.markCoolingDown(CRYPTO_SEARCH_COOLDOWN_SECONDS);
      throw error;
    }
  }
  const local = searchCryptoCatalog(catalog, query);
  if (local.length > 0) return local;

  const cacheKey = query.trim().toLowerCase();
  const cached = await store.getSearch(cacheKey);
  if (cached !== null) return cached;
  if (await store.isCoolingDown()) throw new ProviderRateLimitedError("coingecko");
  try {
    const hits = (await searchCoinGecko(query, ctx)).slice(0, CRYPTO_SEARCH_LIMIT);
    await store.setSearch(cacheKey, hits, CRYPTO_SEARCH_CACHE_TTL_SECONDS);
    return hits;
  } catch (error) {
    if (error instanceof ProviderRateLimitedError) await store.markCoolingDown(CRYPTO_SEARCH_COOLDOWN_SECONDS);
    throw error;
  }
}
