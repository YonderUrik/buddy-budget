import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { goals } from "@/lib/db/schema/goals";
import { withCountryGuard } from "@/lib/localization/guard";
import { bindRequestUser, recordGoalAction, requestLogger, withRoute } from "@/lib/observability";
import { reorderGoalsSchema } from "@/lib/validation/goals";

/** Nuovo ordine di priorità: gli id devono essere esattamente tutti gli obiettivi dell'utente. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = reorderGoalsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { ids } = parsed.data;
  const owned = await db.select({ id: goals.id }).from(goals).where(eq(goals.userId, userId));
  const ownedIds = new Set(owned.map((g) => g.id));
  if (ids.length !== ownedIds.size || new Set(ids).size !== ids.length || ids.some((id) => !ownedIds.has(id))) {
    return Response.json({ error: "L'elenco degli obiettivi non è aggiornato: ricarica la pagina" }, { status: 409 });
  }
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) await tx.update(goals).set({ priority: index }).where(eq(goals.id, id));
  });
  recordGoalAction("reordered", "all");
  requestLogger().info("goals.goal.reordered", { count: ids.length });
  return Response.json({ ok: true });
}

export const POST = withCountryGuard(withRoute("goals.reorder", handlePost));
