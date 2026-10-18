import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { budgets } from "@/lib/db/schema/budgets";
import { categories } from "@/lib/db/schema/categories";
import { upsertBudgetSchema } from "@/lib/validation/budgets";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/**
 * Crea o aggiorna (upsert) il budget mensile di una categoria del proprio utente.
 * Il categoryId arriva dall'URL: viene verificato che appartenga all'utente autenticato
 * prima di qualunque scrittura, per evitare un IDOR su una tabella (categories) altrui
 * (404 sia per categoria inesistente sia per categoria di un altro utente).
 */
async function handlePut(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const { categoryId } = await params;
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, session.user.id)));
  if (!category) {
    return new Response(null, { status: 404 });
  }

  if (category.type === "trasferimento") return Response.json({ error: "I trasferimenti sono esclusi dal budget" }, { status: 400 });

  const body = await request.json();
  const parsed = upsertBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [budget] = await db
    .insert(budgets)
    .values({ userId: session.user.id, categoryId, monthlyAmount: parsed.data.monthlyAmount.toFixed(2) })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId],
      set: { monthlyAmount: parsed.data.monthlyAmount.toFixed(2), updatedAt: new Date() },
    })
    .returning();

  requestLogger().info("budget.monthly.saved");
  return Response.json(budget);
}

/**
 * Removes the monthly budget of one of the user's categories (the category has no budget afterwards).
 * Idempotent: 204 also when no budget existed; the `userId` filter keeps other users' rows out of reach.
 */
async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const { categoryId } = await params;
  const removed = await db
    .delete(budgets)
    .where(and(eq(budgets.categoryId, categoryId), eq(budgets.userId, session.user.id)))
    .returning({ id: budgets.id });

  requestLogger().info("budget.monthly.removed", { count: removed.length });
  return new Response(null, { status: 204 });
}

export const PUT = withRoute("budgets.upsert", handlePut);
export const DELETE = withRoute("budgets.remove", handleDelete);
