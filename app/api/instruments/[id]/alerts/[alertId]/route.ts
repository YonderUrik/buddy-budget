import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { userPriceAlerts } from "@/lib/db/schema/investments";
import { bindRequestUser, withRoute } from "@/lib/observability";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Elimina un avviso dell'utente (attivo o già scattato). */
async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string; alertId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id, alertId } = await params;
  if (!UUID.test(alertId)) return Response.json({ error: "Avviso non trovato" }, { status: 404 });

  const deleted = await db
    .delete(userPriceAlerts)
    .where(and(eq(userPriceAlerts.id, alertId), eq(userPriceAlerts.userId, session.user.id), eq(userPriceAlerts.instrumentId, id)))
    .returning({ id: userPriceAlerts.id });
  if (deleted.length === 0) return Response.json({ error: "Avviso non trovato" }, { status: 404 });
  return Response.json({ id: alertId });
}

export const DELETE = withRoute("instruments.alert_delete", handleDelete);
