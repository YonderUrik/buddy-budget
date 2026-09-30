import { NextRequest } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { userPriceAlerts } from "@/lib/db/schema/investments";
import { isAlertTriggered } from "@/lib/investments/alerts";
import { latestClose } from "@/lib/investments/alerts-run";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { createPriceAlertSchema, MAX_ACTIVE_ALERTS_PER_INSTRUMENT } from "@/lib/validation/investments";

/**
 * Crea un avviso di prezzo (livello nella valuta dello strumento). Solo per strumenti con prezzi automatici: il
 * controllo serale legge le chiusure delle fonti. Se l'ultima chiusura ha già superato il livello si rifiuta,
 * altrimenti l'avviso scatterebbe la sera stessa senza dire niente di nuovo.
 */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;
  const { id } = await params;
  const instrument = await findVisibleInstrument(userId, id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  if (instrument.priceMode !== "auto") {
    return Response.json({ error: "Gli avvisi funzionano solo per gli strumenti con prezzi automatici" }, { status: 400 });
  }

  const parsed = createPriceAlertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { direction, targetPrice } = parsed.data;

  const [{ active }] = await db
    .select({ active: count() })
    .from(userPriceAlerts)
    .where(and(eq(userPriceAlerts.userId, userId), eq(userPriceAlerts.instrumentId, id), eq(userPriceAlerts.status, "attivo")));
  if (active >= MAX_ACTIVE_ALERTS_PER_INSTRUMENT) {
    return Response.json({ error: `Al massimo ${MAX_ACTIVE_ALERTS_PER_INSTRUMENT} avvisi attivi per titolo` }, { status: 400 });
  }
  const last = await latestClose(id);
  if (last && isAlertTriggered(direction, targetPrice, last.close)) {
    return Response.json({ error: "L'ultima chiusura è già oltre questo livello" }, { status: 400 });
  }

  const [created] = await db
    .insert(userPriceAlerts)
    .values({ userId, instrumentId: id, direction, targetPrice: String(targetPrice) })
    .returning();
  return Response.json(created, { status: 201 });
}

export const POST = withRoute("instruments.alert_create", handlePost);
