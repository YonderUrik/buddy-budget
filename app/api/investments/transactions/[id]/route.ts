import { NextRequest, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { instruments, investmentTransactions } from "@/lib/db/schema/investments";
import { findOwnPortfolio, loadUserTransactions } from "@/lib/investments/data";
import { ensureHistorySafely } from "@/lib/investments/history";
import { oversoldMessage, toCalcInput, todayKey, toRowValues } from "@/lib/investments/operations";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { updateInvestmentTransactionSchema } from "@/lib/validation/investments";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

async function findOwnTransaction(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(investmentTransactions)
    .where(and(eq(investmentTransactions.id, id), eq(investmentTransactions.userId, userId)));
  return row ?? null;
}

/** Modifica un'operazione (si rimanda intera). Il cambio, se non indicato, resta quello salvato. */
async function handlePatch(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const { id } = await params;
  const current = await findOwnTransaction(userId, id);
  if (!current) return Response.json({ error: "Operazione non trovata" }, { status: 404 });
  const portfolio = await findOwnPortfolio(userId, current.portfolioId);
  if (current.statementAccountKey || portfolio?.broker?.startsWith("ibkr:")) return Response.json({ error: "Operazione di un rendiconto riconciliato: non modificabile singolarmente" }, { status: 409 });

  const parsed = updateInvestmentTransactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  if (parsed.data.date > todayKey()) return Response.json({ error: "La data non può essere nel futuro" }, { status: 400 });

  const values = toRowValues(parsed.data, parsed.data.fxRate ?? Number(current.fxRate));
  const others = (await loadUserTransactions(userId, current.instrumentId)).filter((t) => t.id !== id).map(toCalcInput);
  const message = oversoldMessage([...others, { id, instrumentId: current.instrumentId, ...values }]);
  if (message) {
    requestLogger().warn("investments.operation.update_rejected", { reason: "oversold", operationType: parsed.data.type });
    return Response.json({ error: message }, { status: 400 });
  }

  const [updated] = await db
    .update(investmentTransactions)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(investmentTransactions.id, id), eq(investmentTransactions.userId, userId)))
    .returning();
  const [instrument] = await db.select().from(instruments).where(eq(instruments.id, current.instrumentId));
  if (instrument) await ensureHistorySafely(instrument, parsed.data.date, after);
  requestLogger().info("investments.operation.updated", { operationType: updated.type });
  return Response.json(updated);
}

/** Elimina un'operazione, se senza di essa nessuna vendita successiva supera le quote possedute. */
async function handleDelete(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const { id } = await params;
  const current = await findOwnTransaction(userId, id);
  if (!current) return Response.json({ error: "Operazione non trovata" }, { status: 404 });
  const portfolio = await findOwnPortfolio(userId, current.portfolioId);
  if (current.statementAccountKey || portfolio?.broker?.startsWith("ibkr:")) return Response.json({ error: "Operazione di un rendiconto riconciliato: non modificabile singolarmente" }, { status: 409 });

  const remaining = (await loadUserTransactions(userId, current.instrumentId)).filter((t) => t.id !== id).map(toCalcInput);
  const message = oversoldMessage(remaining);
  if (message) {
    return Response.json({ error: `Non si può eliminare: ${message.charAt(0).toLowerCase()}${message.slice(1)}` }, { status: 400 });
  }

  await db
    .delete(investmentTransactions)
    .where(and(eq(investmentTransactions.id, id), eq(investmentTransactions.userId, userId)));
  return new Response(null, { status: 204 });
}

export const PATCH = withRoute("investment_transactions.update", handlePatch);
export const DELETE = withRoute("investment_transactions.delete", handleDelete);
