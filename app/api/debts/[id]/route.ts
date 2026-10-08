import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { debts } from "@/lib/db/schema/debts";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { updateDebtSchema } from "@/lib/validation/debts";

type Params = { params: Promise<{ id: string }> };

/** Modifica nome e spese di un debito dell'utente. */
async function handlePatch(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const parsed = updateDebtSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { id } = await params;
  const [updated] = await db
    .update(debts)
    .set({
      name: parsed.data.name,
      costs: parsed.data.costs,
      updatedAt: new Date(),
    })
    .where(and(eq(debts.id, id), eq(debts.userId, session.user.id)))
    .returning({ id: debts.id });
  return updated ? Response.json(updated) : Response.json({ error: "Debito non trovato" }, { status: 404 });
}

/** Elimina un debito dell'utente con tutti i suoi eventi. */
async function handleDelete(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  const deleted = await db
    .delete(debts)
    .where(and(eq(debts.id, id), eq(debts.userId, session.user.id)))
    .returning({ id: debts.id });
  return deleted.length > 0 ? new Response(null, { status: 204 }) : Response.json({ error: "Debito non trovato" }, { status: 404 });
}

export const PATCH = withRoute("debts.update", handlePatch);
export const DELETE = withRoute("debts.delete", handleDelete);
