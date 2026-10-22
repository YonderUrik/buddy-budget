import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { createBudgets } from "@/lib/budgets/store.server";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { apiError, validationError } from "@/lib/http";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { acceptProposalsSchema } from "@/lib/validation/budgets";

/**
 * POST /api/budgets/accept-proposals — creates in one go the budgets the user kept from the app's proposals («Usa
 * questi budget»), with the amounts possibly changed. Every category must be one of the user's expense categories;
 * a category that meanwhile got a budget keeps it.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const parsed = acceptProposalsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const ids = [...new Set(parsed.data.items.map((item) => item.categoryId))];
  const owned = await db
    .select({ id: categories.id, type: categories.type })
    .from(categories)
    .where(and(eq(categories.userId, session.user.id), inArray(categories.id, ids)));
  if (owned.length !== ids.length || owned.some((c) => c.type === "entrata" || c.type === "trasferimento")) {
    return apiError(404, "category_not_found", "Categoria non trovata");
  }

  const created = await createBudgets(session.user.id, parsed.data.items, new Date());
  requestLogger().info("budget.proposals.accepted", { count: created });
  return Response.json({ created });
}

export const POST = withRoute("budgets.accept_proposals", handlePost);
