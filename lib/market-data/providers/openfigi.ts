import { ProviderError, errorForStatus } from "../errors";
import { PROVIDER_TIMEOUT_MS, readJson } from "../http";
import type { ProviderContext } from "../types";

const PROVIDER = "openfigi";
const MAPPING_URL = "https://api.openfigi.com/v3/mapping";

/**
 * Borse di OpenFIGI (`exchCode`) che l'app propone, in ordine di preferenza, con il suffisso Yahoo corrispondente.
 * OpenFIGI restituisce centinaia di quotazioni per ISIN (circuiti secondari, una per valuta): le altre si scartano.
 */
export const OPENFIGI_EXCHANGE_SUFFIX: Readonly<Record<string, string>> = {
  IM: "MI",
  GY: "DE",
  GR: "DE",
  NA: "AS",
  LN: "L",
  SW: "SW",
  FP: "PA",
  US: "",
};
const EXCHANGE_ORDER = Object.keys(OPENFIGI_EXCHANGE_SUFFIX);
/** Ticker accettati: lettere, cifre, punto e trattino (BRK/B diventa BRK-B come su Yahoo). */
const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/;
const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/** Quotazione candidata di un ISIN, con il simbolo nello stile Yahoo. */
export interface OpenFigiListing {
  yahooSymbol: string;
  exchCode: string;
}

interface MappingResponseItem {
  data?: { ticker?: string; exchCode?: string }[];
  warning?: string;
  error?: string;
}

/**
 * Quotazioni di un ISIN sulle borse che l'app gestisce, dalla più preferita (Milano, Xetra, Amsterdam...) alla meno.
 * Il simbolo è una stima: la valuta e l'esistenza su Yahoo vanno confermate prima di usarlo. Array vuoto se OpenFIGI
 * non conosce l'ISIN; lancia `ProviderError` se la fonte non risponde. Senza chiave i limiti sono più bassi
 * (25 richieste al minuto), ma qui basta una richiesta per strumento.
 */
export async function fetchOpenFigiListings(isin: string, ctx: ProviderContext): Promise<OpenFigiListing[]> {
  if (!ISIN_PATTERN.test(isin)) return [];
  const apiKey = ctx.env.OPENFIGI_API_KEY;
  let response: Response;
  try {
    response = await ctx.fetch(MAPPING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { "X-OPENFIGI-APIKEY": apiKey } : {}) },
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin }]),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProviderError(PROVIDER, error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network");
  }
  if (!response.ok) throw errorForStatus(PROVIDER, response.status);
  const body = await readJson<MappingResponseItem[]>(PROVIDER, response);
  const listings = new Map<string, OpenFigiListing>();
  for (const item of Array.isArray(body) ? body : []) {
    for (const entry of item.data ?? []) {
      const suffix = entry.exchCode ? OPENFIGI_EXCHANGE_SUFFIX[entry.exchCode] : undefined;
      const ticker = entry.ticker?.trim().toUpperCase().replace("/", "-");
      if (suffix === undefined || !entry.exchCode || !ticker || !TICKER_PATTERN.test(ticker)) continue;
      const yahooSymbol = suffix ? `${ticker}.${suffix}` : ticker;
      if (!listings.has(yahooSymbol)) listings.set(yahooSymbol, { yahooSymbol, exchCode: entry.exchCode });
    }
  }
  return [...listings.values()].sort((a, b) => EXCHANGE_ORDER.indexOf(a.exchCode) - EXCHANGE_ORDER.indexOf(b.exchCode));
}
