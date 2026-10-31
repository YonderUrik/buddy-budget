import type { InstrumentType } from "@/lib/db/schema/investments";
import type { OpenFigiListing } from "@/lib/market-data/providers/openfigi";
import type { YahooSearchHit } from "@/lib/market-data/providers/yahoo";

/** Quotazioni proposte al massimo per ISIN: le altre sono varianti poco usate della stessa borsa. */
export const MAX_QUOTATION_CANDIDATES = 3;
/** Simboli verificati su Yahoo al massimo per richiesta (una chiamata ciascuno, in fila: Yahoo va in raffreddamento se lo si martella). */
export const MAX_QUOTATION_CHECKS = 8;

/** Dipendenze di rete: elenco delle quotazioni di un ISIN (OpenFIGI) e valuta/borsa di un simbolo (Yahoo). */
export interface IsinListingsDeps {
  listings(isin: string): Promise<OpenFigiListing[]>;
  quoteMeta(symbol: string): Promise<{ currency: string | null; exchange: string | null } | null>;
}

/** Quotazione di OpenFIGI confermata su Yahoo, con la valuta e la borsa lette da Yahoo. */
export interface VerifiedListing {
  listing: OpenFigiListing;
  currency: string;
  exchange: string | null;
}

export type VerifiedListingsResult =
  | { status: "ok"; listings: VerifiedListing[] }
  /** OpenFIGI non conosce l'ISIN, o nessuna quotazione esiste su Yahoo nella valuta chiesta. */
  | { status: "empty" }
  /** Una fonte non ha risposto: riprovare più tardi. */
  | { status: "unavailable" };

/**
 * Quotazioni di un ISIN che esistono su Yahoo, con la borsa preferita per prima; con `currency` solo quelle nella
 * valuta indicata (quella del rendiconto o del file). Il simbolo di OpenFIGI è una stima: senza la conferma di Yahoo
 * non si propone, perché un simbolo plausibile ma diverso darebbe prezzi sbagliati.
 */
/**
 * Main exchange of a non-euro currency: without the broker's exchange, a US stock in USD goes to New York and not to
 * its USD line in London (Meta on `0QZI.L`, Corsair on `0A95.L`, which have a short history). Euro securities keep the
 * app's order, since they trade in several euro markets.
 */
const HOME_EXCHANGE: Readonly<Record<string, string>> = {
  USD: "US", GBP: "LN", CHF: "SW", HKD: "HK", PLN: "PW", CAD: "CT", AUD: "AU", JPY: "JT", SEK: "SS", NOK: "NO", DKK: "DC",
};

export async function verifyIsinListings(isin: string, currency: string | null, deps: IsinListingsDeps, preferredExchange: string | null = null): Promise<VerifiedListingsResult> {
  let listings: OpenFigiListing[];
  try {
    listings = await deps.listings(isin);
  } catch {
    return { status: "unavailable" };
  }
  // The exchange the broker reports comes first: it is the listing the user trades, with the longest history.
  const preferred = preferredExchange ?? (currency ? HOME_EXCHANGE[currency] ?? null : null);
  if (preferred) listings = [...listings.filter((l) => l.exchCode === preferred), ...listings.filter((l) => l.exchCode !== preferred)];
  const verified: VerifiedListing[] = [];
  let failures = 0;
  const toCheck = listings.slice(0, MAX_QUOTATION_CHECKS);
  for (const listing of toCheck) {
    if (verified.length >= MAX_QUOTATION_CANDIDATES) break;
    try {
      const meta = await deps.quoteMeta(listing.yahooSymbol);
      if (meta?.currency && (currency === null || meta.currency === currency)) {
        verified.push({ listing, currency: meta.currency, exchange: meta.exchange });
      }
    } catch {
      failures += 1;
    }
  }
  if (verified.length > 0) return { status: "ok", listings: verified };
  return failures > 0 && failures === toCheck.length ? { status: "unavailable" } : { status: "empty" };
}

/**
 * Tipo proposto dal tipo di OpenFIGI. Quotare in borsa un "Mutual Fund" di OpenFIGI (così sono classificati anche gli
 * ETF UCITS) vuol dire quasi sempre un ETF: l'utente lo vede nella proposta "da controllare" e può cambiare strumento.
 */
export function instrumentTypeFromFigi(listing: Pick<OpenFigiListing, "name" | "securityType">): InstrumentType {
  const type = listing.securityType?.toLowerCase() ?? "";
  if (type.includes("common stock") || type.includes("depositary receipt")) return "azione";
  if (type.includes("mutual fund") || type === "etp" || /\b(ETF|UCITS|ETP)\b/i.test(listing.name ?? "")) return "etf";
  if (type.includes("fund")) return "fondo";
  return "azione";
}

/**
 * Risultati nello stile della ricerca Yahoo per un ISIN che Yahoo non trova da solo: servono all'import e alla
 * ricerca strumenti. Il nome è quello di OpenFIGI, o l'ISIN se manca.
 */
export async function searchByIsinOnOpenFigi(isin: string, currency: string | null, deps: IsinListingsDeps, preferredExchange: string | null = null): Promise<VerifiedListingsResult & { hits: YahooSearchHit[] }> {
  const result = await verifyIsinListings(isin, currency, deps, preferredExchange);
  const hits =
    result.status === "ok"
      ? result.listings.map(({ listing, exchange }) => ({
          symbol: listing.yahooSymbol,
          name: listing.name ?? isin,
          exchange: exchange ?? listing.exchCode,
          exchangeLabel: exchange ?? listing.exchCode,
          type: instrumentTypeFromFigi(listing),
        }))
      : [];
  return { ...result, hits };
}
