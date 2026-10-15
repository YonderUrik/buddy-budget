import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { goals } from "@/lib/db/schema/goals";
import { MAX_GOALS } from "@/lib/goals/constants";
import { loadGoalsView } from "@/lib/goals/data";
import { checkGoalSources, countGoals, replaceGoalSources } from "@/lib/goals/server";
import { withCountryGuard } from "@/lib/localization/guard";
import { bindRequestUser, recordGoalAction, requestLogger, withRoute } from "@/lib/observability";
import { createGoalSchema } from "@/lib/validation/goals";

export const maxDuration = 30;

/** Obiettivi dell'utente con il piano del risparmio, le parti libere e il confronto con il traguardo delle Analitiche. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await loadGoalsView(session.user.id));
}

/** Crea un obiettivo con le sue fonti; senza posizione esplicita va in fondo alla lista. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;
  const log = requestLogger();

  const parsed = createGoalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;

  const existing = await countGoals(userId);
  if (existing >= MAX_GOALS) {
    log.info("goals.goal.rejected", { reason: "limit", count: existing });
    return Response.json({ error: `Puoi avere al massimo ${MAX_GOALS} obiettivi` }, { status: 409 });
  }
  const sourceError = await checkGoalSources(userId, input.sources);
  if (sourceError) return Response.json({ error: sourceError }, { status: 404 });

  const priority = Math.min(input.priority ?? existing, existing);
  const row = await db.transaction(async (tx) => {
    // Chi sta da `priority` in giù scende di un posto per fare spazio.
    const all = await tx.select({ id: goals.id, priority: goals.priority }).from(goals).where(eq(goals.userId, userId));
    const sorted = all.sort((a, b) => a.priority - b.priority);
    const [created] = await tx
      .insert(goals)
      .values({
        userId,
        name: input.name,
        kind: input.kind,
        targetAmount: input.targetAmount.toFixed(2),
        targetDate: input.targetDate ?? null,
        monthlyAmount: input.monthlyAmount.toFixed(2),
        priority,
      })
      .returning();
    for (const [index, goal] of sorted.entries()) {
      const next = index < priority ? index : index + 1;
      if (goal.priority !== next) await tx.update(goals).set({ priority: next }).where(eq(goals.id, goal.id));
    }
    await replaceGoalSources(tx, userId, created.id, input.sources);
    return created;
  });

  recordGoalAction("created", input.kind);
  log.info("goals.goal.created", { kind: input.kind, count: input.sources.length });
  return Response.json({ id: row.id }, { status: 201 });
}

export const GET = withCountryGuard(withRoute("goals.list", handleGet));
export const POST = withCountryGuard(withRoute("goals.create", handlePost));
