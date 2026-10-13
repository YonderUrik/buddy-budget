import { after, NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { investmentPortfolios } from "@/lib/db/schema/investments";
import { getOrCreateDefaultPortfolio, loadUserTransactions } from "@/lib/investments/data";
import { ensureFxHistorySafely, ensureHistorySafely } from "@/lib/investments/history";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { todayKey } from "@/lib/investments/operations";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { updatePortfolioSchema } from "@/lib/validation/investments";

export const maxDuration = 300;

/**
 * Impostazioni del portafoglio: strumento di confronto (benchmark) e regime fiscale. Scegliendo il benchmark se ne scarica in
 * background lo storico (prezzi e cambi) dalla prima operazione, così il confronto copre tutto il periodo "Max".
 * Richiamarlo con lo stesso strumento riprova un recupero fallito.
 */
async function handlePatch(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = updatePortfolioSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { benchmarkInstrumentId, taxRegime } = parsed.data;

  const instrument = benchmarkInstrumentId ? await findVisibleInstrument(userId, benchmarkInstrumentId) : null;
  if (benchmarkInstrumentId && !instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  if (instrument && instrument.priceMode !== "auto") {
    return Response.json({ error: "Come confronto serve uno strumento con prezzi automatici" }, { status: 400 });
  }

  const portfolio = await getOrCreateDefaultPortfolio(userId);
  const [updated] = await db
    .update(investmentPortfolios)
    .set({
      ...(benchmarkInstrumentId !== undefined ? { benchmarkInstrumentId } : {}),
      ...(taxRegime ? { taxRegime } : {}),
      updatedAt: new Date(),
    })
    .where(eq(investmentPortfolios.id, portfolio.id))
    .returning();

  if (instrument) {
    const [first] = await loadUserTransactions(userId);
    const fromKey = first?.date ?? todayKey();
    await ensureHistorySafely(instrument, fromKey, after);
    ensureFxHistorySafely(instrument.currency, fromKey, after);
  }
  return Response.json(updated);
}

export const PATCH = withRoute("investment_portfolio.update", handlePatch);
