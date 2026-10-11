import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { subscriptions } from "@/lib/db/schema/subscriptions";
import { updateSubscriptionSchema } from "@/lib/validation/subscriptions";
import { bindRequestUser, recordSubscriptionAction, requestLogger, withRoute } from "@/lib/observability";

type Context = { params: Promise<{ id: string }> };

async function ownedRow(userId: string, id: string) {
  const [row] = await db.select().from(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
  return row ?? null;
}

/** Modifica una scelta salvata (stato, nome, importo, cadenza, prossima data, categoria). 404 se non è dell'utente. */
async function handlePatch(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const { id } = await params;
  const row = await ownedRow(userId, id);
  if (!row) return new Response(null, { status: 404 });
  const parsed = updateSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { amount, categoryId, status, ...rest } = parsed.data;

  if (categoryId) {
    const [category] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
    if (!category) return Response.json({ error: "Categoria non trovata" }, { status: 404 });
  }
  const [updated] = await db
    .update(subscriptions)
    .set({ ...rest, ...(status ? { status } : {}), ...(amount !== undefined ? { amount: amount.toFixed(2) } : {}), ...(categoryId !== undefined ? { categoryId } : {}), updatedAt: new Date() })
    .where(eq(subscriptions.id, id))
    .returning();
  const action = status === "terminato" ? "ended" : status === "escluso" ? "excluded" : status && status !== row.status ? "confirmed" : "updated";
  recordSubscriptionAction(action);
  requestLogger().info("subscriptions.decision.saved", { action });
  return Response.json(updated);
}

/** Toglie la scelta: un abbonamento rilevato torna «da confermare», uno manuale viene eliminato. */
async function handleDelete(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  const row = await ownedRow(session.user.id, id);
  if (!row) return new Response(null, { status: 404 });
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  const action = row.origin === "manuale" ? "removed" : "restored";
  recordSubscriptionAction(action);
  requestLogger().info("subscriptions.decision.saved", { action });
  return new Response(null, { status: 204 });
}

export const PATCH = withRoute("subscriptions.update", handlePatch);
export const DELETE = withRoute("subscriptions.delete", handleDelete);
