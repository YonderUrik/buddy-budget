import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { budgets } from "@/lib/db/schema/budgets";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Ritorna tutti i budget mensili configurati dall'utente autenticato. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const userBudgets = await db.select().from(budgets).where(eq(budgets.userId, session.user.id));
  return Response.json(userBudgets);
}

export const GET = withRoute("budgets.list", handleGet);
