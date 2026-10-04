import { NextRequest, after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { investmentTransactions } from "@/lib/db/schema/investments";
import { findOwnPortfolio, getOrCreateDefaultPortfolio, loadUserTransactions } from "@/lib/investments/data";
import { ensureHistorySafely, fetchFxAround } from "@/lib/investments/history";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import {
  getUserCurrency,
  oversoldMessage,
  resolveOperationFxRate,
  toCalcInput,
  todayKey,
  toRowValues,
} from "@/lib/investments/operations";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { createInvestmentTransactionSchema } from "@/lib/validation/investments";

// Il recupero dei prezzi dalla data dell'operazione gira in after().
export const maxDuration = 300;

/**
 * Registra un'operazione. Controlla che lo strumento sia visibile e il portafoglio sia dell'utente, precompila il
 * cambio se manca e rifiuta le vendite oltre le quote possedute a quella data.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = createInvestmentTransactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;
  if (input.date > todayKey()) return Response.json({ error: "La data non può essere nel futuro" }, { status: 400 });

  const instrument = await findVisibleInstrument(userId, input.instrumentId);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  const portfolio = input.portfolioId
    ? await findOwnPortfolio(userId, input.portfolioId)
    : await getOrCreateDefaultPortfolio(userId);
  if (!portfolio) return Response.json({ error: "Portafoglio non trovato" }, { status: 404 });
  if (portfolio.broker?.startsWith("ibkr:")) return Response.json({ error: "Questo portafoglio si aggiorna importando il rendiconto successivo" }, { status: 409 });

  const fxRate =
    input.fxRate ?? (await resolveOperationFxRate(instrument, await getUserCurrency(userId), input.date, fetchFxAround));
  if (fxRate === null) {
    return Response.json({ error: "Cambio non disponibile per questa data: inseriscilo a mano" }, { status: 422 });
  }

  const values = toRowValues(input, fxRate);
  const existing = (await loadUserTransactions(userId, instrument.id)).map(toCalcInput);
  const message = oversoldMessage([...existing, { id: "nuova", instrumentId: instrument.id, ...values }]);
  if (message) return Response.json({ error: message }, { status: 400 });

  const [created] = await db
    .insert(investmentTransactions)
    .values({ userId, portfolioId: portfolio.id, instrumentId: instrument.id, ...values })
    .returning();
  await ensureHistorySafely(instrument, input.date, after);
  return Response.json(created, { status: 201 });
}

export const POST = withRoute("investment_transactions.create", handlePost);
