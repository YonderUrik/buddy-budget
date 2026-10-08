import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { instruments, type Instrument } from "@/lib/db/schema/investments";
import { saveSymbols } from "@/lib/market-data/store";
import { deriveSymbols } from "@/lib/market-data/symbols";
import { verifyIsinListings, type IsinListingsDeps } from "./isin-listings";

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
  deps: IsinListingsDeps
): Promise<QuotationCandidatesResult> {
  if (!canLinkQuotation(instrument, userId)) return { status: "not_eligible" };
  const result = await verifyIsinListings(instrument.isin!, instrument.currency, deps);
  if (result.status !== "ok") return { status: result.status };
  return {
    status: "ok",
    candidates: result.listings.map(({ listing, exchange, currency }) => ({ symbol: listing.yahooSymbol, exchange, currency })),
  };
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
  deps: IsinListingsDeps
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

/**
 * Collega in automatico uno strumento manuale con ISIN alla prima quotazione verificata (la preferita), come l'utente
 * farebbe da «Cerca la quotazione». Non lancia mai: se non c'è nulla da collegare o le fonti non rispondono restituisce
 * `null` e lo strumento resta com'era.
 */
export async function autoLinkQuotation(instrument: Instrument, userId: string, deps: IsinListingsDeps): Promise<LinkQuotationOutcome & { ok: true } | null> {
  if (!canLinkQuotation(instrument, userId)) return null;
  try {
    const found = await findQuotationCandidates(instrument, userId, deps);
    if (found.status !== "ok") return null;
    const outcome = await linkQuotation(instrument, userId, found.candidates[0].symbol, deps);
    return outcome.ok ? outcome : null;
  } catch {
    return null;
  }
}
