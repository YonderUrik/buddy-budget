import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { subscriptions } from "@/lib/db/schema/subscriptions";
import { subscriptionKey } from "@/lib/calc/subscriptions";
import { loadSubscriptions } from "@/lib/subscriptions/data";
import { createSubscriptionSchema } from "@/lib/validation/subscriptions";
import { bindRequestUser, recordSubscriptionAction, requestLogger, withRoute } from "@/lib/observability";

/** Abbonamenti rilevati dalle transazioni, uniti alle scelte dell'utente, con totali. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await loadSubscriptions(session.user.id));
}

/**
 * Registra una scelta su un abbonamento rilevato (conferma, esclusione, terminato: upsert sulla chiave) o aggiunge un
 * abbonamento a mano. La categoria, se c'è, deve essere dell'utente.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = createSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;

  if (input.categoryId) {
    const [category] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)));
    if (!category) return Response.json({ error: "Categoria non trovata" }, { status: 404 });
  }

  const log = requestLogger();
  if (input.origin === "rilevato") {
    const values = { userId, key: input.key, status: input.status, origin: "rilevato" as const, name: input.name, amount: input.amount.toFixed(2), cadence: input.cadence, categoryId: input.categoryId ?? null };
    const [row] = await db
      .insert(subscriptions)
      .values(values)
      .onConflictDoUpdate({ target: [subscriptions.userId, subscriptions.key], set: { status: input.status, updatedAt: new Date() } })
      .returning();
    const action = input.status === "confermato" ? "confirmed" : input.status === "escluso" ? "excluded" : "ended";
    recordSubscriptionAction(action);
    log.info("subscriptions.decision.saved", { action });
    return Response.json(row);
  }

  const key = subscriptionKey(input.name);
  if (key.length === 0) return Response.json({ error: "Il nome non è valido" }, { status: 400 });
  const [existing] = await db.select({ id: subscriptions.id }).from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.key, key)));
  if (existing) return Response.json({ error: "Hai già un abbonamento con questo nome" }, { status: 409 });
  const [row] = await db
    .insert(subscriptions)
    .values({ userId, key, status: "confermato", origin: "manuale", name: input.name, amount: input.amount.toFixed(2), cadence: input.cadence, nextDate: input.nextDate, categoryId: input.categoryId ?? null })
    .returning();
  recordSubscriptionAction("added");
  log.info("subscriptions.manual.created", { action: "added" });
  return Response.json(row, { status: 201 });
}

export const GET = withRoute("subscriptions.list", handleGet);
export const POST = withRoute("subscriptions.save", handlePost);
