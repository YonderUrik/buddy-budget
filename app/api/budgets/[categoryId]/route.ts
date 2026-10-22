import { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/http";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { removeBudget, saveBudget } from "@/lib/budgets/store.server";
import { categories } from "@/lib/db/schema/categories";
import { upsertBudgetSchema } from "@/lib/validation/budgets";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/**
 * Creates or changes the budget of one of the user's categories: the amount that repeats every month, rollover of the
 * leftover, or the amount of one month only. The categoryId comes from the URL and is checked against the signed-in
 * user before any write (404 both for a missing category and for another user's one, no IDOR).
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
    return apiError(404, "category_not_found", "Categoria non trovata");
  }

  if (category.type === "trasferimento") return apiError(400, "transfer_without_budget", "I trasferimenti sono esclusi dal budget");

  const body = await request.json();
  const parsed = upsertBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const result = await saveBudget(session.user.id, category, parsed.data, new Date());
  if (!result.ok) {
    return result.reason === "past_month"
      ? apiError(400, "past_month", "Un mese già passato non si può cambiare", { field: "singleMonth" })
      : apiError(404, "budget_not_found", "Questa categoria non ha un budget");
  }

  requestLogger().info("budget.monthly.saved", {
    outcome: result.created ? "created" : "updated",
  });
  return Response.json(result.budget);
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
  const removed = await removeBudget(session.user.id, categoryId);

  requestLogger().info("budget.monthly.removed", { count: removed });
  return new Response(null, { status: 204 });
}

export const PUT = withRoute("budgets.upsert", handlePut);
export const DELETE = withRoute("budgets.remove", handleDelete);
