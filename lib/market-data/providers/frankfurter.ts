import { providerGet, readJson } from "../http";
import type { FxDailyRate, FxProvider } from "../types";

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/";

interface FrankfurterResponse {
  rates?: Record<string, Record<string, number>>;
}

/** Converte la risposta di un intervallo Frankfurter in cambi. */
export function parseFrankfurter(body: FrankfurterResponse): FxDailyRate[] {
  const rates: FxDailyRate[] = [];
  for (const [date, byCurrency] of Object.entries(body.rates ?? {})) {
    for (const [currency, perEur] of Object.entries(byCurrency)) {
      if (Number.isFinite(perEur) && perEur > 0) rates.push({ date, currency, perEur });
    }
  }
  return rates;
}

/** Frankfurter: stessi dati BCE da un'altra via d'accesso, riserva per i cambi. */
export const frankfurterProvider: FxProvider = {
  id: "frankfurter",
  async fetchRates(currencies, from, to, ctx) {
    const wanted = currencies.filter((c) => c !== "EUR");
    if (wanted.length === 0) return [];
    const url = `${FRANKFURTER_URL}${from}..${to}?base=EUR&symbols=${wanted.join(",")}`;
    const response = await providerGet("frankfurter", url, ctx, { notFoundAsNull: true });
    return response ? parseFrankfurter(await readJson<FrankfurterResponse>("frankfurter", response)) : [];
  },
};
