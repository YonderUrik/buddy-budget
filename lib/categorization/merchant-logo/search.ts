/**
 * Ricerca del sito di un marchio per nome su Logo.dev (`GET /v2/search`, chiave segreta, solo dal server). Si accetta un
 * risultato solo se il suo nome è esattamente quello cercato: un logo di un'azienda omonima è peggio dell'iniziale.
 */

import { nameSearchKey } from "./name-key";
import { isIntermediaryDomain, registrableDomain } from "./text-domain";

const SEARCH_URL = "https://api.logo.dev/v2/search";
/** Candidati chiesti al servizio: bastano pochi, si tiene solo quello con il nome uguale. */
export const SEARCH_RESULT_LIMIT = 5;
export const SEARCH_TIMEOUT_MS = 5_000;

export interface BrandSearchResult {
  name: string;
  domain: string;
}

/** `found`: un risultato con lo stesso nome; `none`: nessuno; `error`: servizio o rete in errore (anche 429). */
export type BrandSearchOutcome = { outcome: "found"; domain: string } | { outcome: "none" } | { outcome: "error"; status?: number };

/** Dominio del primo risultato con lo stesso nome dell'esercente (stessa chiave di ricerca), o null. */
export function pickMatchingDomain(query: string, results: readonly BrandSearchResult[]): string | null {
  const wanted = nameSearchKey(query);
  if (!wanted) return null;
  for (const result of results) {
    if (nameSearchKey(result.name) !== wanted) continue;
    const domain = registrableDomain(result.domain);
    if (domain && !isIntermediaryDomain(domain)) return domain;
  }
  return null;
}

/** Chiede a Logo.dev i candidati per un nome. Non lancia mai. */
export async function searchBrandDomain(
  name: string,
  deps: { secretKey: string; fetchFn?: typeof fetch }
): Promise<BrandSearchOutcome> {
  try {
    const params = new URLSearchParams({ q: name, limit: String(SEARCH_RESULT_LIMIT) });
    const response = await (deps.fetchFn ?? fetch)(`${SEARCH_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${deps.secretKey}` },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) return { outcome: "error", status: response.status };
    const body = (await response.json()) as { data?: unknown };
    const results = Array.isArray(body.data)
      ? body.data.flatMap((item) =>
          item && typeof item === "object" && typeof item.name === "string" && typeof item.domain === "string"
            ? [{ name: item.name, domain: item.domain }]
            : []
        )
      : [];
    const domain = pickMatchingDomain(name, results);
    return domain ? { outcome: "found", domain } : { outcome: "none" };
  } catch {
    return { outcome: "error" };
  }
}
