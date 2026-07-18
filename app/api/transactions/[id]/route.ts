import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { isValidExcludedAmount, transactions } from "@/lib/db/schema/transactions";
import { updateTransactionSchema } from "@/lib/validation/transactions";

/** Recupera una transazione solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedTransaction(userId: string, transactionId: string) {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  return transaction ?? null;
}

const MANUAL_ONLY_FIELDS = ["description", "amount", "date"] as const;

/**
 * Aggiorna una transazione del proprio utente; 404 se non propria. Per una transazione "auto" sono
 * modificabili solo categoria ed excludedAmount ("Dividi"): un tentativo di cambiare descrizione,
 * importo o data risponde 403.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const transaction = await getOwnedTransaction(session.user.id, id);
  if (!transaction) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (transaction.source === "auto" && MANUAL_ONLY_FIELDS.some((field) => field in parsed.data)) {
    return Response.json(
      { error: 'Per una transazione automatica sono modificabili solo categoria e "Dividi"' },
      { status: 403 }
    );
  }

  const newAmount = parsed.data.amount !== undefined ? -parsed.data.amount : Number(transaction.amount);
  let newExcludedAmount: number | undefined;
  if (parsed.data.excludedAmount !== undefined) {
    newExcludedAmount = -Math.abs(parsed.data.excludedAmount);
    if (!isValidExcludedAmount(newAmount, newExcludedAmount)) {
      return Response.json({ error: "Quota esclusa non valida" }, { status: 400 });
    }
  }

  const { amount, excludedAmount, ...rest } = parsed.data;
  const [updated] = await db
    .update(transactions)
    .set({
      ...rest,
      ...(amount !== undefined ? { amount: newAmount.toFixed(2) } : {}),
      ...(newExcludedAmount !== undefined ? { excludedAmount: newExcludedAmount.toFixed(2) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, id))
    .returning();

  return Response.json(updated);
}

/** Elimina una transazione manuale del proprio utente; 404 se non propria, 400 se auto. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const transaction = await getOwnedTransaction(session.user.id, id);
  if (!transaction) {
    return new Response(null, { status: 404 });
  }

  if (transaction.source === "auto") {
    return Response.json({ error: "Una transazione automatica non può essere eliminata" }, { status: 400 });
  }

  await db.delete(transactions).where(eq(transactions.id, id));
  return new Response(null, { status: 204 });
}
