import { NextRequest } from "next/server";
import { eq, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { pensionFunds } from "@/lib/db/schema/pension";
import { todayIso } from "@/lib/debts/dates";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { PENSION_MAX_FUNDS } from "@/lib/pension/limits";
import { createPensionFundSchema, isPlausiblePensionDate } from "@/lib/validation/pension";

/** Aggiunge un fondo di previdenza (nome e data di prima adesione); restituisce l'id. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = createPensionFundSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;
  if (!isPlausiblePensionDate(input.adhesionDate, todayIso())) return Response.json({ error: "Data di adesione non valida" }, { status: 400 });

  const [{ total }] = await db.select({ total: count() }).from(pensionFunds).where(eq(pensionFunds.userId, userId));
  if (total >= PENSION_MAX_FUNDS) return Response.json({ error: `Puoi tracciare al massimo ${PENSION_MAX_FUNDS} fondi` }, { status: 400 });

  const [created] = await db.insert(pensionFunds).values({ userId, name: input.name, adhesionDate: input.adhesionDate }).returning({ id: pensionFunds.id });
  requestLogger().info("pension.fund.created");
  return Response.json(created, { status: 201 });
}

export const POST = withRoute("pension.funds.create", handlePost);
