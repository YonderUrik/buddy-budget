import { ProviderRateLimitedError } from "../errors";
import { providerGet, readJson } from "../http";
import type { DailyClose, PriceProvider } from "../types";

const ALPHAVANTAGE_URL = "https://www.alphavantage.co/query";
/** Chiamate gratuite al giorno. */
export const ALPHAVANTAGE_DAILY_BUDGET = 25;

interface AlphaVantageDailyResponse {
  "Time Series (Daily)"?: Record<string, { "4. close"?: string }>;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

/** Converte `TIME_SERIES_DAILY`; i messaggi di quota esaurita arrivano con status 200 e vanno riconosciuti. */
export function parseAlphaVantageDaily(body: AlphaVantageDailyResponse): DailyClose[] {
  if (body.Note || (body.Information && /rate limit|requests per day|premium/i.test(body.Information))) {
    throw new ProviderRateLimitedError("alphavantage");
  }
  const series = body["Time Series (Daily)"];
  if (!series) return [];
  return Object.entries(series).map(([date, values]) => ({
    date,
    close: Number(values["4. close"]),
    currency: null,
  }));
}

/** Alpha Vantage: riserva globale con quota bassa (25/giorno), solo per l'aggiornamento giornaliero. */
export const alphaVantageProvider: PriceProvider = {
  id: "alphavantage",
  requiredKeyEnv: "ALPHAVANTAGE_API_KEY",
  maxHistory: "limited",
  dailyBudget: ALPHAVANTAGE_DAILY_BUDGET,
  minDelayMs: 1_500,
  async fetchDailyCloses(symbol, _from, _to, ctx) {
    const url =
      `${ALPHAVANTAGE_URL}?function=TIME_SERIES_DAILY&outputsize=compact&symbol=${encodeURIComponent(symbol)}` +
      `&apikey=${encodeURIComponent(ctx.env.ALPHAVANTAGE_API_KEY ?? "")}`;
    const response = await providerGet("alphavantage", url, ctx);
    return parseAlphaVantageDaily(await readJson<AlphaVantageDailyResponse>("alphavantage", response!));
  },
};
