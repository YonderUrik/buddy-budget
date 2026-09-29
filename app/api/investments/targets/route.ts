import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { instruments, investmentTargets } from "@/lib/db/schema/investments";
import { getOrCreateDefaultPortfolio } from "@/lib/investments/data";
import { visibleTo } from "@/lib/investments/instruments";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { updateTargetsSchema } from "@/lib/validation/investments";

/**
 * Sostituisce l'allocazione obiettivo del portafoglio (per strumento, pesi che sommano a 100%) in una transazione.
 * Una lista vuota toglie l'obiettivo. Gli strumenti devono essere visibili all'utente, anche se non ancora posseduti.
 */
async function handlePut(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = updateTargetsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { targets } = parsed.data;

  const ids = targets.map((t) => t.instrumentId);
  if (ids.length > 0) {
    const visible = await db
      .select({ id: instruments.id })
      .from(instruments)
      .where(and(inArray(instruments.id, ids), visibleTo(userId)));
    if (visible.length !== ids.length) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  }

  const portfolio = await getOrCreateDefaultPortfolio(userId);
  const saved = await db.transaction(async (tx) => {
    await tx.delete(investmentTargets).where(eq(investmentTargets.portfolioId, portfolio.id));
    if (targets.length === 0) return [];
    return tx
      .insert(investmentTargets)
      .values(targets.map((t) => ({ portfolioId: portfolio.id, instrumentId: t.instrumentId, weight: t.weight.toFixed(6) })))
      .returning({ instrumentId: investmentTargets.instrumentId, weight: investmentTargets.weight });
  });
  return Response.json({ targets: saved });
}

export const PUT = withRoute("investment_targets.update", handlePut);
