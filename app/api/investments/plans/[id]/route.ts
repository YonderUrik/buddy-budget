import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { investmentPlans } from "@/lib/db/schema/investments";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { updatePlanSchema } from "@/lib/validation/investments";

type Params = { params: Promise<{ id: string }> };

/** Modifica importo, frequenza, giorno o stato attivo di un PAC dell'utente. */
async function handlePatch(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const parsed = updatePlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { id } = await params;
  const { amount, ...rest } = parsed.data;
  const [updated] = await db
    .update(investmentPlans)
    .set({ ...rest, ...(amount !== undefined ? { amount: amount.toFixed(2) } : {}), updatedAt: new Date() })
    .where(and(eq(investmentPlans.id, id), eq(investmentPlans.userId, session.user.id)))
    .returning();
  return updated ? Response.json(updated) : Response.json({ error: "PAC non trovato" }, { status: 404 });
}

/** Elimina un PAC dell'utente (le operazioni già registrate restano). */
async function handleDelete(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  const deleted = await db
    .delete(investmentPlans)
    .where(and(eq(investmentPlans.id, id), eq(investmentPlans.userId, session.user.id)))
    .returning({ id: investmentPlans.id });
  return deleted.length > 0 ? new Response(null, { status: 204 }) : Response.json({ error: "PAC non trovato" }, { status: 404 });
}

export const PATCH = withRoute("investment_plans.update", handlePatch);
export const DELETE = withRoute("investment_plans.delete", handleDelete);
