import { NextRequest, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { userWatchlistItems } from "@/lib/db/schema/investments";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { ensureHistory } from "@/lib/market-data/runtime";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

export const maxDuration = 300;

/** Storico che si prepara quando si segue un titolo, così la pagina non è vuota (giorni). */
const WATCH_HISTORY_DAYS = 380;

/** Segue lo strumento (watchlist). Idempotente: seguirlo due volte non fa danni. */
async function handlePut(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id } = await params;
  const instrument = await findVisibleInstrument(session.user.id, id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });

  await db.insert(userWatchlistItems).values({ userId: session.user.id, instrumentId: id }).onConflictDoNothing();
  try {
    const from = new Date(Date.now() - WATCH_HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
    await ensureHistory(instrument, from, after);
  } catch (error) {
    requestLogger().warn("market.backfill.not_started", { error });
  }
  return Response.json({ instrumentId: id, watching: true });
}

/** Smette di seguire lo strumento. Gli avvisi e le operazioni non si toccano. */
async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id } = await params;
  await db
    .delete(userWatchlistItems)
    .where(and(eq(userWatchlistItems.userId, session.user.id), eq(userWatchlistItems.instrumentId, id)));
  return Response.json({ instrumentId: id, watching: false });
}

export const PUT = withRoute("instruments.watch", handlePut);
export const DELETE = withRoute("instruments.unwatch", handleDelete);
