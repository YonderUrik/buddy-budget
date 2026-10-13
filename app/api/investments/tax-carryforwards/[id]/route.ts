import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { investmentTaxCarryforwards } from "@/lib/db/schema/investments";
import { bindRequestUser, withRoute } from "@/lib/observability";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Elimina una minusvalenza pregressa dell'utente (404 se non è sua). */
async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Non trovata" }, { status: 404 });
  const deleted = await db
    .delete(investmentTaxCarryforwards)
    .where(and(eq(investmentTaxCarryforwards.id, id), eq(investmentTaxCarryforwards.userId, session.user.id)))
    .returning({ id: investmentTaxCarryforwards.id });
  if (deleted.length === 0) return Response.json({ error: "Non trovata" }, { status: 404 });
  return new Response(null, { status: 204 });
}

export const DELETE = withRoute("tax_carryforwards.delete", handleDelete);
