import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { debtEvents } from "@/lib/db/schema/debts";
import { findOwnDebt, loadUserDebts } from "@/lib/debts/data";
import { checkEventApplicable, ownsTransaction } from "@/lib/debts/events";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { createDebtEventSchema } from "@/lib/validation/debts";

type Params = { params: Promise<{ id: string }> };

/** Registra un evento (rata, cambio tasso, correzione, estinzione) su un debito dell'utente. */
async function handlePost(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = createDebtEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;

  const { id } = await params;
  const debt = await findOwnDebt(userId, id);
  if (!debt) return Response.json({ error: "Debito non trovato" }, { status: 404 });

  if (input.type === "payment" && input.transactionId && !(await ownsTransaction(userId, input.transactionId))) {
    return Response.json({ error: "Transazione non trovata" }, { status: 404 });
  }

  const { events } = await loadUserDebts(userId);
  const problem = checkEventApplicable(debt, events.filter((e) => e.debtId === debt.id), input);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const [created] = await db
    .insert(debtEvents)
    .values({
      debtId: debt.id,
      userId,
      type: input.type,
      date: input.date,
      amount: "amount" in input ? input.amount.toFixed(2) : null,
      installmentNumber: input.type === "payment" ? input.installmentNumber : null,
      rate: input.type === "rate_change" ? input.rate.toFixed(4) : null,
      penalty: input.type === "early_repayment" ? input.penalty.toFixed(2) : null,
      effect: input.type === "early_repayment" ? input.effect : null,
      transactionId: input.type === "payment" ? (input.transactionId ?? null) : null,
      note: input.note ?? null,
    })
    .returning({ id: debtEvents.id });
  return Response.json(created, { status: 201 });
}

export const POST = withRoute("debts.events.create", handlePost);
