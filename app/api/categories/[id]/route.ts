import { localizeCategory } from "@/lib/localization/categories";
import { resolveProfile } from "@/lib/localization/config";
import { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/http";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { budgets } from "@/lib/db/schema/budgets";
import { transactions } from "@/lib/db/schema/transactions";
import { updateCategorySchema } from "@/lib/validation/categories";
import { bindRequestUser, withRoute } from "@/lib/observability";

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
async function handlePatch(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const { id } = await params;
  const category = await getOwnedCategory(session.user.id, id);
  if (!category) {
    return apiError(404, "category_not_found", "Categoria non trovata");
  }

  const body = await request.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  // Saving a displayed default label is not a rename (including the protected fallback).
  const displayed = localizeCategory(category, resolveProfile(session.user));
  if (parsed.data.name === displayed.name) delete parsed.data.name;
  if (parsed.data.description === displayed.description) delete parsed.data.description;

  if (Object.keys(parsed.data).length === 0) return Response.json(category);

  if (category.isFallback && parsed.data.name && parsed.data.name !== category.name) {
    return apiError(409, "fallback_category_locked", "Il nome della categoria di fallback non può essere modificato");
  }

  if (parsed.data.name && parsed.data.name !== category.name) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, session.user.id), eq(categories.name, parsed.data.name)));
    if (existing) {
      return apiError(409, "category_exists", "Categoria già esistente");
    }
  }

  if (category.isFallback && parsed.data.type === "trasferimento") {
    return apiError(400, "fallback_category_locked", "La categoria da categorizzare non può diventare un trasferimento");
  }
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(categories).set({ ...parsed.data, ...(parsed.data.name && parsed.data.name !== category.name ? { defaultKey: null } : {}) }).where(eq(categories.id, id)).returning();
    if (parsed.data.type && parsed.data.type !== category.type &&
        (parsed.data.type === "trasferimento" || category.type === "trasferimento")) {
      await tx.update(transactions).set({
        excludedAmount: parsed.data.type === "trasferimento" ? sql`${transactions.amount}` : "0",
        updatedAt: new Date(),
      }).where(and(eq(transactions.categoryId, id), eq(transactions.userId, session.user.id)));
      if (parsed.data.type === "trasferimento") await tx.delete(budgets).where(eq(budgets.categoryId, id));
    }
    return row;
  });

  return Response.json(updated);
}

/**
 * Elimina una categoria del proprio utente; 404 se non propria, 409 se è la
 * categoria fallback. Le transazioni collegate vengono riassegnate alla
 * categoria fallback ("Da categorizzare") e il budget collegato eliminato,
 * nella stessa transazione DB della cancellazione.
 */
async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const { id } = await params;
  const category = await getOwnedCategory(session.user.id, id);
  if (!category) {
    return apiError(404, "category_not_found", "Categoria non trovata");
  }

  if (category.isFallback) {
    return apiError(409, "fallback_category_locked", "La categoria di fallback non può essere eliminata");
  }

  const fallback = await getFallbackCategory(session.user.id);
  if (!fallback) {
    return Response.json({ error: "Categoria di fallback non trovata" }, { status: 500 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(transactions)
      // Tornano «Da categorizzare»: senza origine, altrimenti resterebbero tra le «Messe dall'app» con una categoria che non c'è più.
      .set({
        categoryId: fallback.id,
        categorySource: null,
        categoryConfidence: null,
        categorizedAt: null,
        ...(category.type === "trasferimento" ? { excludedAmount: "0" } : {}),
      })
      .where(eq(transactions.categoryId, id));
    await tx.delete(budgets).where(eq(budgets.categoryId, id));
    await tx.delete(categories).where(eq(categories.id, id));
  });

  return new Response(null, { status: 204 });
}

export const PATCH = withRoute("categories.update", handlePatch);
export const DELETE = withRoute("categories.delete", handleDelete);
