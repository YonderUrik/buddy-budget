import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { debtEvents } from "@/lib/db/schema/debts";
import { findOwnDebt, loadUserDebts } from "@/lib/debts/data";
import { todayIso } from "@/lib/debts/dates";
import { buildDebtsView } from "@/lib/debts/view";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { DEBT_MAX_INSTALLMENTS } from "@/lib/validation/debts";

type Params = { params: Promise<{ id: string }> };

const bulkSchema = z.object({ upToInstallment: z.number().int().min(1).max(DEBT_MAX_INSTALLMENTS) });

/**
 * Segna come pagate in un colpo le rate già scadute e non ancora saldate fino alla rata indicata, con data e importo del
 * piano. Serve a chiudere il pregresso di un finanziamento in corso senza segnare le rate una per una.
 */
async function handlePost(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = bulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Numero di rata non valido" }, { status: 400 });

  const { id } = await params;
  const debt = await findOwnDebt(userId, id);
  if (!debt) return Response.json({ error: "Debito non trovato" }, { status: 404 });
  if (debt.kind !== "loan") return Response.json({ error: "Una linea di credito non ha rate" }, { status: 400 });

  const today = todayIso();
  const { events } = await loadUserDebts(userId);
  const { debts } = buildDebtsView([debt], events.filter((e) => e.debtId === debt.id), today);
  const rows = debts[0].plan.rows.filter((r) => r.status !== "pagata" && r.number <= parsed.data.upToInstallment && r.dueDate <= today);
  if (rows.length === 0) return Response.json({ error: "Nessuna rata scaduta da segnare" }, { status: 400 });

  await db.insert(debtEvents).values(
    rows.map((r) => ({
      debtId: debt.id,
      userId,
      type: "payment" as const,
      date: r.dueDate,
      amount: r.installment.toFixed(2),
      installmentNumber: r.number,
    }))
  );
  return Response.json({ count: rows.length }, { status: 201 });
}

export const POST = withRoute("debts.payments.bulk", handlePost);
