import { NextRequest, after } from "next/server";
import { eq, and, min } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { investmentTransactions } from "@/lib/db/schema/investments";
import { ensureHistorySafely } from "@/lib/investments/history";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import type { IsinListingsDeps } from "@/lib/investments/isin-listings";
import { canLinkQuotation, findQuotationCandidates, linkQuotation } from "@/lib/investments/link-quotation";
import { listingsOnOpenFigi, quoteMetaOnProviders } from "@/lib/market-data/runtime";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { linkQuotationSchema } from "@/lib/validation/investments";

// Le conferme su Yahoo sono in fila (una chiamata per quotazione) e il recupero dello storico gira in after().
export const maxDuration = 300;

const deps: IsinListingsDeps = { listings: listingsOnOpenFigi, quoteMeta: quoteMetaOnProviders };

/**
 * Quotazioni a cui si può collegare uno strumento manuale con ISIN: OpenFIGI propone, Yahoo conferma l'esistenza e
 * la valuta del rendiconto. Non scrive nulla.
 */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const instrument = await findVisibleInstrument(session.user.id, (await params).id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  const result = await findQuotationCandidates(instrument, session.user.id, deps);
  if (result.status === "not_eligible") return Response.json({ error: "Questo strumento non si può collegare a una quotazione" }, { status: 409 });
  requestLogger().info("instrument.quotation.candidates", { outcome: result.status, count: result.status === "ok" ? result.candidates.length : 0 });
  return Response.json(result);
}

/** Collega lo strumento manuale alla quotazione scelta e avvia il recupero dei prezzi dalla prima operazione. */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const instrument = await findVisibleInstrument(userId, (await params).id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  if (!canLinkQuotation(instrument, userId)) {
    return Response.json({ error: "Questo strumento ha già i prezzi automatici o non ha un ISIN" }, { status: 409 });
  }
  const parsed = linkQuotationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const outcome = await linkQuotation(instrument, userId, parsed.data.yahooSymbol, deps);
  if (!outcome.ok) {
    requestLogger().warn("instrument.quotation.link_failed", { status: outcome.status });
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  requestLogger().info("instrument.quotation.linked", { provider: "yahoo", symbol: outcome.candidate.symbol });

  const [first] = await db
    .select({ date: min(investmentTransactions.date) })
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.instrumentId, instrument.id)));
  if (first?.date) await ensureHistorySafely(outcome.instrument, first.date, after);
  return Response.json(outcome.instrument);
}

export const GET = withRoute("instruments.quotation_candidates", handleGet);
export const POST = withRoute("instruments.quotation_link", handlePost);
