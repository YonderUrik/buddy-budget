import { ProviderError } from "../errors";
import { providerGet, readJson, toUnixSeconds, utcDateKey } from "../http";
import type { DailyClose, PriceProvider } from "../types";

const COINGECKO_URL = "https://api.coingecko.com/api/v3/";

interface MarketChartResponse {
  prices?: [number, number][];
}

/**
 * Riduce la serie di CoinGecko (oraria sotto i 90 giorni) a un prezzo per giorno UTC: l'ultimo del giorno.
 * La valuta è quella chiesta con `vs_currency`.
 */
export function parseCoinGeckoChart(body: MarketChartResponse, currency: string): DailyClose[] {
  const byDate = new Map<string, DailyClose>();
  for (const [ms, price] of body.prices ?? []) {
    const date = utcDateKey(ms);
    byDate.set(date, { date, close: price, currency: currency.toUpperCase() });
  }
  return [...byDate.values()];
}

/**
 * CoinGecko: prima fonte per le crypto. Il simbolo è l'id CoinGecko seguito dalla valuta (`bitcoin:EUR`),
 * perché la stessa crypto si può seguire in valute diverse. La chiave demo è facoltativa.
 */
export const coinGeckoProvider: PriceProvider = {
  id: "coingecko",
  requiredKeyEnv: null,
  maxHistory: "unlimited",
  minDelayMs: 2_500,
  async fetchDailyCloses(symbol, from, to, ctx) {
    const [id, currency] = symbol.split(":");
    if (!id || !currency) throw new ProviderError("coingecko", "invalid symbol");
    const url =
      `${COINGECKO_URL}coins/${encodeURIComponent(id)}/market_chart/range` +
      `?vs_currency=${currency.toLowerCase()}&from=${toUnixSeconds(from)}&to=${toUnixSeconds(to) + 86_400}`;
    const key = ctx.env.COINGECKO_API_KEY;
    const response = await providerGet("coingecko", url, ctx, {
      notFoundAsNull: true,
      headers: key ? { "x-cg-demo-api-key": key } : {},
    });
    return response ? parseCoinGeckoChart(await readJson<MarketChartResponse>("coingecko", response), currency) : [];
  },
};

interface CoinGeckoSearchResponse {
  coins?: { id?: string; name?: string; symbol?: string }[];
}

/** Id CoinGecko delle crypto che corrispondono alla ricerca (per nome o simbolo). */
export async function searchCoinGecko(
  query: string,
  ctx: Parameters<PriceProvider["fetchDailyCloses"]>[3]
): Promise<{ id: string; name: string; symbol: string }[]> {
  const url = `${COINGECKO_URL}search?query=${encodeURIComponent(query)}`;
  const key = ctx.env.COINGECKO_API_KEY;
  const response = await providerGet("coingecko", url, ctx, {
    notFoundAsNull: true,
    headers: key ? { "x-cg-demo-api-key": key } : {},
  });
  if (!response) return [];
  const body = await readJson<CoinGeckoSearchResponse>("coingecko", response);
  return (body.coins ?? [])
    .filter((c): c is { id: string; name: string; symbol: string } => Boolean(c.id && c.name && c.symbol))
    .slice(0, 10);
}
