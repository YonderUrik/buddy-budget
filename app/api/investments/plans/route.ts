import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { investmentPlans } from "@/lib/db/schema/investments";
import { findOwnPortfolio, getOrCreateDefaultPortfolio } from "@/lib/investments/data";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { createPlanSchema } from "@/lib/validation/investments";

/** Crea un PAC: serve a mostrare l'importo e a precompilare le operazioni, non genera operazioni da solo. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = createPlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  if (!(await findVisibleInstrument(userId, parsed.data.instrumentId))) {
    return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  }
  const portfolio = parsed.data.portfolioId
    ? await findOwnPortfolio(userId, parsed.data.portfolioId)
    : await getOrCreateDefaultPortfolio(userId);
  if (!portfolio) return Response.json({ error: "Portafoglio non trovato" }, { status: 404 });

  const [created] = await db
    .insert(investmentPlans)
    .values({
      userId,
      portfolioId: portfolio.id,
      instrumentId: parsed.data.instrumentId,
      amount: parsed.data.amount.toFixed(2),
      frequency: parsed.data.frequency,
      dayOfMonth: parsed.data.dayOfMonth,
    })
    .returning();
  return Response.json(created, { status: 201 });
}

export const POST = withRoute("investment_plans.create", handlePost);
