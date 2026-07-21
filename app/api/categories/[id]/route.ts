import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { budgets } from "@/lib/db/schema/budgets";
import { transactions } from "@/lib/db/schema/transactions";
import { updateCategorySchema } from "@/lib/validation/categories";

/** Recupera una categoria solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedCategory(userId: string, categoryId: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return category ?? null;
}

/** Recupera la categoria fallback ("Da categorizzare") del proprio utente. */
async function getFallbackCategory(userId: string) {
  const [fallback] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
  return fallback ?? null;
}

/**
 * Aggiorna nome/tipo/icona/colore di una categoria del proprio utente; 404 se non propria,
 * 409 se nome duplicato o se si tenta di rinominare la categoria fallback (icona/colore/tipo
 * restano modificabili anche per la fallback).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const category = await getOwnedCategory(session.user.id, id);
  if (!category) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (category.isFallback && parsed.data.name && parsed.data.name !== category.name) {
    return Response.json(
      { error: "Il nome della categoria di fallback non può essere modificato" },
      { status: 409 }
    );
  }

  if (parsed.data.name && parsed.data.name !== category.name) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, session.user.id), eq(categories.name, parsed.data.name)));
    if (existing) {
      return Response.json({ error: "Categoria già esistente" }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(categories)
    .set(parsed.data)
    .where(eq(categories.id, id))
    .returning();

  return Response.json(updated);
}

/**
 * Elimina una categoria del proprio utente; 404 se non propria, 409 se è la
 * categoria fallback. Le transazioni collegate vengono riassegnate alla
 * categoria fallback ("Da categorizzare") e il budget collegato eliminato,
 * nella stessa transazione DB della cancellazione.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const category = await getOwnedCategory(session.user.id, id);
  if (!category) {
    return new Response(null, { status: 404 });
  }

  if (category.isFallback) {
    return Response.json(
      { error: "La categoria di fallback non può essere eliminata" },
      { status: 409 }
    );
  }

  const fallback = await getFallbackCategory(session.user.id);
  if (!fallback) {
    return Response.json({ error: "Categoria di fallback non trovata" }, { status: 500 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(transactions)
      .set({ categoryId: fallback.id })
      .where(eq(transactions.categoryId, id));
    await tx.delete(budgets).where(eq(budgets.categoryId, id));
    await tx.delete(categories).where(eq(categories.id, id));
  });

  return new Response(null, { status: 204 });
}
