import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { pensionFunds } from "@/lib/db/schema/pension";
import { todayIso } from "@/lib/debts/dates";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { findOwnPensionFund } from "@/lib/pension/data";
import { isPlausiblePensionDate, updatePensionFundSchema } from "@/lib/validation/pension";

type Params = { params: Promise<{ id: string }> };

/** Aggiorna nome o data di adesione di un fondo dell'utente. */
async function handlePatch(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = updatePensionFundSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;
  if (input.adhesionDate !== undefined && !isPlausiblePensionDate(input.adhesionDate, todayIso())) {
    return Response.json({ error: "Data di adesione non valida" }, { status: 400 });
  }

  const { id } = await params;
  if (!(await findOwnPensionFund(userId, id))) return Response.json({ error: "Fondo non trovato" }, { status: 404 });

  await db
    .update(pensionFunds)
    .set({ ...(input.name !== undefined ? { name: input.name } : {}), ...(input.adhesionDate !== undefined ? { adhesionDate: input.adhesionDate } : {}), updatedAt: new Date() })
    .where(and(eq(pensionFunds.id, id), eq(pensionFunds.userId, userId)));
  requestLogger().info("pension.fund.updated");
  return new Response(null, { status: 204 });
}

/** Elimina un fondo dell'utente con tutte le sue fotografie. */
async function handleDelete(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const { id } = await params;
  if (!(await findOwnPensionFund(userId, id))) return Response.json({ error: "Fondo non trovato" }, { status: 404 });

  await db.delete(pensionFunds).where(and(eq(pensionFunds.id, id), eq(pensionFunds.userId, userId)));
  requestLogger().info("pension.fund.deleted");
  return new Response(null, { status: 204 });
}

export const PATCH = withRoute("pension.funds.update", handlePatch);
export const DELETE = withRoute("pension.funds.delete", handleDelete);
