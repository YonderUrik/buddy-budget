import { ProviderError, ProviderRateLimitedError } from "../errors";
import { providerGet, readJson } from "../http";
import type { DailyClose, PriceProvider } from "../types";

const TWELVEDATA_URL = "https://api.twelvedata.com/time_series";
/** Crediti gratuiti al giorno (piano Basic: solo mercato USA). */
export const TWELVEDATA_DAILY_BUDGET = 800;

interface TwelveDataResponse {
  status?: string;
  code?: number;
  meta?: { currency?: string };
  values?: { datetime?: string; close?: string }[];
}

/** Converte `time_series`; gli errori arrivano con status 200 e `status: "error"`. */
export function parseTwelveData(body: TwelveDataResponse): DailyClose[] {
  if (body.status === "error") {
    if (body.code === 429) throw new ProviderRateLimitedError("twelvedata", 429);
    if (body.code === 400 || body.code === 404) return [];
    throw new ProviderError("twelvedata", "api error", body.code);
  }
  const currency = body.meta?.currency?.toUpperCase() ?? null;
  return (body.values ?? [])
    .filter((v): v is { datetime: string; close: string } => Boolean(v.datetime && v.close))
    .map((v) => ({ date: v.datetime.slice(0, 10), close: Number(v.close), currency }));
}

/** Twelve Data: riserva per le azioni USA (il piano gratuito non copre le borse europee). */
export const twelveDataProvider: PriceProvider = {
  id: "twelvedata",
  requiredKeyEnv: "TWELVEDATA_API_KEY",
  maxHistory: "limited",
  dailyBudget: TWELVEDATA_DAILY_BUDGET,
  minDelayMs: 8_000,
  async fetchDailyCloses(symbol, from, to, ctx) {
    const url =
      `${TWELVEDATA_URL}?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${from}&end_date=${to}` +
      `&apikey=${encodeURIComponent(ctx.env.TWELVEDATA_API_KEY ?? "")}`;
    const response = await providerGet("twelvedata", url, ctx);
    return parseTwelveData(await readJson<TwelveDataResponse>("twelvedata", response!));
  },
};
