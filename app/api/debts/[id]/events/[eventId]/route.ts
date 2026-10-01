import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { debtEvents } from "@/lib/db/schema/debts";
import { bindRequestUser, withRoute } from "@/lib/observability";

type Params = { params: Promise<{ id: string; eventId: string }> };

/** Elimina un evento di un debito dell'utente: il piano si ricalcola senza di lui. */
async function handleDelete(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id, eventId } = await params;
  const deleted = await db
    .delete(debtEvents)
    .where(and(eq(debtEvents.id, eventId), eq(debtEvents.debtId, id), eq(debtEvents.userId, session.user.id)))
    .returning({ id: debtEvents.id });
  return deleted.length > 0 ? new Response(null, { status: 204 }) : Response.json({ error: "Evento non trovato" }, { status: 404 });
}

export const DELETE = withRoute("debts.events.delete", handleDelete);
