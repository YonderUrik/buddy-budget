import { ProviderError } from "../errors";
import { providerGet, readJson, toUnixSeconds, utcDateKey } from "../http";
import type { DailyClose, PriceProvider } from "../types";

const KRAKEN_URL = "https://api.kraken.com/0/public/OHLC";
const DAILY_INTERVAL_MINUTES = 1440;

interface KrakenOhlcResponse {
  error?: string[];
  result?: Record<string, unknown>;
}

/** Converte la risposta OHLC di Kraken; la valuta non è dichiarata (è nel simbolo della coppia, es. XBTEUR). */
export function parseKrakenOhlc(body: KrakenOhlcResponse): DailyClose[] {
  if (body.error && body.error.length > 0) {
    if (body.error.some((e) => e.includes("Unknown asset pair"))) return [];
    throw new ProviderError("kraken", "api error");
  }
  const series = Object.entries(body.result ?? {}).find(([key]) => key !== "last")?.[1];
  if (!Array.isArray(series)) return [];
  return series
    .filter((row): row is unknown[] => Array.isArray(row) && row.length >= 5)
    .map((row) => ({ date: utcDateKey(Number(row[0]) * 1000), close: Number(row[4]), currency: null }));
}

/** Kraken: API pubblica senza chiave, riserva per le crypto (al massimo 720 giorni per richiesta). */
export const krakenProvider: PriceProvider = {
  id: "kraken",
  requiredKeyEnv: null,
  maxHistory: "unlimited",
  minDelayMs: 1_000,
  async fetchDailyCloses(symbol, from, _to, ctx) {
    const url = `${KRAKEN_URL}?pair=${encodeURIComponent(symbol)}&interval=${DAILY_INTERVAL_MINUTES}&since=${toUnixSeconds(from) - 86_400}`;
    const response = await providerGet("kraken", url, ctx);
    return parseKrakenOhlc(await readJson<KrakenOhlcResponse>("kraken", response!));
  },
};
