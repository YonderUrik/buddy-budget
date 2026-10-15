import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { goals } from "@/lib/db/schema/goals";
import { checkGoalSources, ownedGoal, replaceGoalSources } from "@/lib/goals/server";
import { withCountryGuard } from "@/lib/localization/guard";
import { bindRequestUser, recordGoalAction, requestLogger, withRoute } from "@/lib/observability";
import { updateGoalSchema } from "@/lib/validation/goals";

type Context = { params: Promise<{ id: string }> };

/** Modifica un obiettivo: dati, fonti (sostituite in blocco) o stato raggiunto. 404 se non è dell'utente. */
async function handlePatch(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;
  const { id } = await params;
  const row = await ownedGoal(userId, id);
  if (!row) return new Response(null, { status: 404 });

  const parsed = updateGoalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { sources, achieved, targetAmount, monthlyAmount, ...rest } = parsed.data;
  if (sources) {
    const sourceError = await checkGoalSources(userId, sources);
    if (sourceError) return Response.json({ error: sourceError }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(goals)
      .set({
        ...rest,
        ...(targetAmount !== undefined ? { targetAmount: targetAmount.toFixed(2) } : {}),
        ...(monthlyAmount !== undefined ? { monthlyAmount: monthlyAmount.toFixed(2) } : {}),
        ...(achieved !== undefined ? { achievedAt: achieved ? (row.achievedAt ?? new Date()) : null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(goals.id, id));
    if (sources) await replaceGoalSources(tx, userId, id, sources);
  });

  const kind = rest.kind ?? row.kind;
  const log = requestLogger();
  if (achieved !== undefined && achieved !== (row.achievedAt !== null)) {
    const action = achieved ? "achieved" : "reopened";
    recordGoalAction(action, kind);
    log.info(`goals.goal.${action}`, { kind });
  } else {
    recordGoalAction("updated", kind);
    log.info("goals.goal.updated", { kind, ...(sources ? { count: sources.length } : {}) });
  }
  return Response.json({ id });
}

/** Elimina un obiettivo e le sue fonti; gli altri risalgono di un posto. I saldi veri non cambiano. */
async function handleDelete(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;
  const { id } = await params;
  const row = await ownedGoal(userId, id);
  if (!row) return new Response(null, { status: 404 });

  await db.transaction(async (tx) => {
    await tx.delete(goals).where(eq(goals.id, id));
    const rest = await tx.select({ id: goals.id, priority: goals.priority, createdAt: goals.createdAt }).from(goals).where(eq(goals.userId, userId));
    rest.sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());
    for (const [index, goal] of rest.entries()) if (goal.priority !== index) await tx.update(goals).set({ priority: index }).where(eq(goals.id, goal.id));
  });
  recordGoalAction("deleted", row.kind);
  requestLogger().info("goals.goal.deleted", { kind: row.kind });
  return new Response(null, { status: 204 });
}

export const PATCH = withCountryGuard(withRoute("goals.update", handlePatch));
export const DELETE = withCountryGuard(withRoute("goals.delete", handleDelete));
