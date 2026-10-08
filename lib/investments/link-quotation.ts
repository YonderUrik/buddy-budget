import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { instruments, type Instrument } from "@/lib/db/schema/investments";
import { saveSymbols } from "@/lib/market-data/store";
import { deriveSymbols } from "@/lib/market-data/symbols";
import type { OpenFigiListing } from "@/lib/market-data/providers/openfigi";

/** Quotazioni proposte al massimo all'utente: le altre sono varianti poco usate della stessa borsa. */
export const MAX_QUOTATION_CANDIDATES = 3;
/** Simboli verificati su Yahoo al massimo per richiesta (una chiamata ciascuno, in fila: Yahoo va in raffreddamento se lo si martella). */
export const MAX_QUOTATION_CHECKS = 8;

/** Dipendenze di rete: elenco delle quotazioni di un ISIN (OpenFIGI) e valuta/borsa di un simbolo (Yahoo). */
export interface LinkQuotationDeps {
  listings(isin: string): Promise<OpenFigiListing[]>;
  quoteMeta(symbol: string): Promise<{ currency: string | null; exchange: string | null } | null>;
}

/** Quotazione verificata su Yahoo, con la stessa valuta dello strumento. */
export interface QuotationCandidate {
  symbol: string;
  exchange: string | null;
  currency: string;
}

export type QuotationCandidatesResult =
  | { status: "ok"; candidates: QuotationCandidate[] }
  /** OpenFIGI non conosce l'ISIN o nessuna quotazione ha la valuta dello strumento. */
  | { status: "empty" }
  /** Una fonte non ha risposto: riprovare più tardi. */
  | { status: "unavailable" }
  /** Lo strumento non può essere collegato (non è manuale, senza ISIN o non è dell'utente). */
  | { status: "not_eligible" };

/** Solo gli strumenti manuali dell'utente con un ISIN possono essere collegati a una quotazione. */
export function canLinkQuotation(instrument: Instrument, userId: string): boolean {
  return instrument.priceMode === "manuale" && instrument.createdByUserId === userId && !!instrument.isin;
}

/**
 * Quotazioni di un ISIN che esistono su Yahoo nella stessa valuta dello strumento (quella del rendiconto), con la
 * borsa preferita per prima. Il simbolo di OpenFIGI è una stima: senza la conferma di Yahoo, e della valuta, non
 * si propone, perché un simbolo plausibile ma diverso darebbe prezzi sbagliati.
 */
export async function findQuotationCandidates(
  instrument: Instrument,
  userId: string,
  deps: LinkQuotationDeps
): Promise<QuotationCandidatesResult> {
  if (!canLinkQuotation(instrument, userId)) return { status: "not_eligible" };
  let listings: OpenFigiListing[];
  try {
    listings = await deps.listings(instrument.isin!);
  } catch {
    return { status: "unavailable" };
  }
  const candidates: QuotationCandidate[] = [];
  let failures = 0;
  const toCheck = listings.slice(0, MAX_QUOTATION_CHECKS);
  for (const listing of toCheck) {
    if (candidates.length >= MAX_QUOTATION_CANDIDATES) break;
    try {
      const meta = await deps.quoteMeta(listing.yahooSymbol);
      if (meta?.currency === instrument.currency) candidates.push({ symbol: listing.yahooSymbol, exchange: meta.exchange, currency: meta.currency });
    } catch {
      failures += 1;
    }
  }
  if (candidates.length > 0) return { status: "ok", candidates };
  return failures > 0 && failures === toCheck.length ? { status: "unavailable" } : { status: "empty" };
}

export type LinkQuotationOutcome =
  | { ok: true; instrument: Instrument; candidate: QuotationCandidate }
  | { ok: false; status: 404 | 409 | 422 | 502; error: string };

/**
 * Collega uno strumento manuale alla quotazione scelta: aggiunge i simboli delle fonti e passa ai prezzi
 * automatici. Il simbolo deve essere uno di quelli che il server propone per quell'ISIN (mai fidarsi del client).
 * I prezzi manuali dell'utente restano salvati, ma la pagina mostra quelli automatici.
 */
export async function linkQuotation(
  instrument: Instrument,
  userId: string,
  yahooSymbol: string,
  deps: LinkQuotationDeps
): Promise<LinkQuotationOutcome> {
  if (!canLinkQuotation(instrument, userId)) return { ok: false, status: 409, error: "Questo strumento ha già i prezzi automatici o non ha un ISIN" };
  const found = await findQuotationCandidates(instrument, userId, deps);
  if (found.status === "unavailable") return { ok: false, status: 502, error: "Fonte prezzi non raggiungibile, riprova tra poco" };
  const candidate = found.status === "ok" ? found.candidates.find((c) => c.symbol === yahooSymbol) : undefined;
  if (!candidate) return { ok: false, status: 422, error: "Quotazione non valida per questo strumento" };

  const symbols = deriveSymbols({ isin: instrument.isin, type: instrument.type, currency: instrument.currency, yahooSymbol: candidate.symbol });
  await saveSymbols(instrument.id, symbols);
  const [updated] = await db
    .update(instruments)
    .set({ priceMode: "auto", exchange: candidate.exchange, updatedAt: new Date() })
    .where(and(eq(instruments.id, instrument.id), eq(instruments.priceMode, "manuale")))
    .returning();
  if (!updated) return { ok: false, status: 409, error: "Lo strumento è già stato collegato" };
  return { ok: true, instrument: updated, candidate };
}
