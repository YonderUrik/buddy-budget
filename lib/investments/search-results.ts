import type { InstrumentType } from "@/lib/db/schema/investments";
import type { YahooSearchHit } from "@/lib/market-data/providers/yahoo";

/** Crypto trovata su CoinGecko. */
export interface CryptoSearchHit {
  id: string;
  name: string;
  symbol: string;
}

/** Ordine dei gruppi nella ricerca: prima gli strumenti più comuni in un portafoglio, le crypto in fondo. */
export const SEARCH_TYPE_ORDER: readonly InstrumentType[] = ["etf", "azione", "fondo", "obbligazione", "etc", "crypto"];

/** Crypto mostrate al massimo, anche quando la ricerca sembra proprio una crypto. */
export const MAX_CRYPTO_RESULTS = 5;

/** Un risultato di mercato da aggiungere: da Yahoo (ETF, azioni, fondi…) o da CoinGecko (crypto). */
export type MarketSearchItem = { source: "yahoo"; hit: YahooSearchHit } | { source: "coingecko"; coin: CryptoSearchHit };

/** Risultati di mercato di un solo tipo. */
export interface SearchResultGroup {
  type: InstrumentType;
  items: MarketSearchItem[];
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Tiene solo le crypto pertinenti. CoinGecko restituisce qualunque token che contenga la ricerca: cercando "apple"
 * o "vwce" escono decine di token sconosciuti. Se Yahoo ha trovato altro, la ricerca era quasi certamente per un
 * titolo, quindi restano solo le crypto con simbolo o nome identici alla ricerca; altrimenti anche quelle il cui
 * simbolo o nome inizia con la ricerca.
 */
export function relevantCrypto(coins: CryptoSearchHit[], query: string, hasMarketResults: boolean): CryptoSearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  return coins
    .filter((coin) => {
      const symbol = normalize(coin.symbol);
      const name = normalize(coin.name);
      if (symbol === q || name === q) return true;
      return !hasMarketResults && (symbol.startsWith(q) || name.startsWith(q));
    })
    .slice(0, MAX_CRYPTO_RESULTS);
}

/**
 * Raggruppa per tipo i risultati di Yahoo e CoinGecko, nell'ordine di `SEARCH_TYPE_ORDER`; i gruppi vuoti non ci
 * sono. Le crypto di Yahoo (es. `BTC-EUR`) si scartano quando CoinGecko ne ha trovate: stessa moneta, due volte.
 */
export function groupSearchResults(market: YahooSearchHit[], crypto: CryptoSearchHit[], query: string): SearchResultGroup[] {
  const stocks = market.filter((hit) => hit.type !== "crypto");
  const coins = relevantCrypto(crypto, query, stocks.length > 0);
  const items: MarketSearchItem[] = [
    ...market.filter((hit) => hit.type !== "crypto" || coins.length === 0).map((hit) => ({ source: "yahoo" as const, hit })),
    ...coins.map((coin) => ({ source: "coingecko" as const, coin })),
  ];
  return SEARCH_TYPE_ORDER.map((type) => ({
    type,
    items: items.filter((item) => (item.source === "coingecko" ? "crypto" : item.hit.type) === type),
  })).filter((group) => group.items.length > 0);
}
