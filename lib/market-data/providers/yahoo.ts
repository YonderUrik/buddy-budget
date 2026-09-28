import type { InstrumentType } from "@/lib/db/schema/investments";
import { ProviderError } from "../errors";
import { providerGet, readJson, toUnixSeconds, utcDateKey } from "../http";
import type { DailyClose, PriceProvider, ProviderContext } from "../types";

const CHART_URL = "https://query2.finance.yahoo.com/v8/finance/chart/";
const SEARCH_URL = "https://query2.finance.yahoo.com/v1/finance/search";

/** Valute quotate in sottounità da Yahoo (pence, cent sudafricani, agorot): prezzo / 100 nella valuta vera. */
const MINOR_UNIT_CURRENCIES: Record<string, string> = { GBp: "GBP", GBX: "GBP", ZAc: "ZAR", ILA: "ILS" };

interface YahooChartResponse {
  chart: {
    result:
      | {
          meta: { currency?: string | null; gmtoffset?: number; exchangeName?: string; symbol?: string };
          timestamp?: number[];
          indicators: { quote: { close?: (number | null)[] }[] };
        }[]
      | null;
    error: { code?: string } | null;
  };
}

/** Valuta vera e divisore per una valuta dichiarata da Yahoo (gestisce le sottounità). */
export function normalizeYahooCurrency(currency: string | null | undefined): { currency: string | null; divisor: number } {
  if (!currency) return { currency: null, divisor: 1 };
  const major = MINOR_UNIT_CURRENCIES[currency];
  return major ? { currency: major, divisor: 100 } : { currency: currency.toUpperCase(), divisor: 1 };
}

/** Converte la risposta `chart` di Yahoo in chiusure giornaliere (data locale della borsa). */
export function parseYahooChart(body: YahooChartResponse): { closes: DailyClose[]; exchange: string | null } {
  const result = body.chart.result?.[0];
  if (!result) return { closes: [], exchange: null };
  const { currency, divisor } = normalizeYahooCurrency(result.meta.currency);
  const offsetMs = (result.meta.gmtoffset ?? 0) * 1000;
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators.quote[0]?.close ?? [];
  const byDate = new Map<string, DailyClose>();
  timestamps.forEach((ts, i) => {
    const close = closes[i];
    if (close === null || close === undefined) return;
    const date = utcDateKey(ts * 1000 + offsetMs);
    byDate.set(date, { date, close: close / divisor, currency });
  });
  return { closes: [...byDate.values()], exchange: result.meta.exchangeName ?? null };
}

async function fetchChart(symbol: string, period1: number, period2: number, ctx: ProviderContext) {
  const url = `${CHART_URL}${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=`;
  const response = await providerGet("yahoo", url, ctx, { notFoundAsNull: true });
  if (!response) return null;
  const body = await readJson<YahooChartResponse>("yahoo", response);
  if (body.chart.error && body.chart.error.code !== "Not Found") throw new ProviderError("yahoo", "chart error");
  return body;
}

/** Yahoo Finance (endpoint non ufficiali `chart` e `search`): prima fonte per ETF, azioni e fondi. */
export const yahooProvider: PriceProvider = {
  id: "yahoo",
  requiredKeyEnv: null,
  maxHistory: "unlimited",
  minDelayMs: 400,
  async fetchDailyCloses(symbol, from, to, ctx) {
    // period2 è esclusivo: si aggiunge un giorno per includere `to`.
    const body = await fetchChart(symbol, toUnixSeconds(from), toUnixSeconds(to) + 86_400, ctx);
    return body ? parseYahooChart(body).closes : [];
  },
};

/** Dati essenziali di una quotazione: valuta e borsa, dall'ultima settimana di `chart`. */
export async function fetchYahooQuoteMeta(
  symbol: string,
  ctx: ProviderContext,
  nowMs: number = Date.now()
): Promise<{ currency: string | null; exchange: string | null } | null> {
  const to = Math.floor(nowMs / 1000);
  const body = await fetchChart(symbol, to - 10 * 86_400, to, ctx);
  const meta = body?.chart.result?.[0]?.meta;
  if (!meta) return null;
  return { currency: normalizeYahooCurrency(meta.currency).currency, exchange: meta.exchangeName ?? null };
}

/** Risultato della ricerca Yahoo, già tradotto nei tipi dell'app. */
export interface YahooSearchHit {
  symbol: string;
  name: string;
  exchange: string;
  exchangeLabel: string;
  type: InstrumentType;
}

interface YahooSearchResponse {
  quotes?: {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    exchDisp?: string;
    quoteType?: string;
  }[];
}

const QUOTE_TYPES: Record<string, InstrumentType> = {
  ETF: "etf",
  EQUITY: "azione",
  MUTUALFUND: "fondo",
  CRYPTOCURRENCY: "crypto",
  BOND: "obbligazione",
};

/** Traduce la risposta di ricerca, scartando i tipi non gestiti (indici, futures, valute). */
export function parseYahooSearch(body: YahooSearchResponse): YahooSearchHit[] {
  const hits: YahooSearchHit[] = [];
  for (const q of body.quotes ?? []) {
    const type = q.quoteType ? QUOTE_TYPES[q.quoteType] : undefined;
    if (!q.symbol || !type) continue;
    hits.push({
      symbol: q.symbol,
      name: q.longname ?? q.shortname ?? q.symbol,
      exchange: q.exchange ?? "",
      exchangeLabel: q.exchDisp ?? q.exchange ?? "",
      type,
    });
  }
  return hits;
}

/** Cerca strumenti per nome, ticker o ISIN. */
export async function searchYahoo(query: string, ctx: ProviderContext): Promise<YahooSearchHit[]> {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0&listsCount=0`;
  const response = await providerGet("yahoo", url, ctx, { notFoundAsNull: true });
  if (!response) return [];
  return parseYahooSearch(await readJson<YahooSearchResponse>("yahoo", response));
}
