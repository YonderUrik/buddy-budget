import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { updateAccountSchema } from "@/lib/validation/accounts";

/** Recupera un conto solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedAccount(userId: string, accountId: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  return account ?? null;
}

/**
 * Aggiorna un conto del proprio utente; 404 se non proprio. Per un conto
 * "auto" sono modificabili solo nome/colore/icona (tipo e saldo arrivano
 * dalla banca collegata): un tentativo di cambiarli risponde 403.
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
  const account = await getOwnedAccount(session.user.id, id);
  if (!account) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (account.source === "auto" && ("type" in parsed.data || "balance" in parsed.data)) {
    return Response.json(
      { error: "Per un conto collegato automaticamente tipo e saldo non sono modificabili" },
      { status: 403 }
    );
  }

  const { balance, ...rest } = parsed.data;
  const [updated] = await db
    .update(accounts)
    .set({
      ...rest,
      ...(balance !== undefined ? { balance: balance.toFixed(2) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, id))
    .returning();

  return Response.json(updated);
}

/** Elimina o scollega un conto del proprio utente, manuale o auto; 404 se non proprio. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const account = await getOwnedAccount(session.user.id, id);
  if (!account) {
    return new Response(null, { status: 404 });
  }

  // transactions.account_id non ha ON DELETE cascade (a differenza di bank_account_links):
  // un conto "auto" con transazioni sincronizzate violerebbe altrimenti il vincolo FK.
  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(eq(transactions.accountId, id));
    await tx.delete(accounts).where(eq(accounts.id, id));
  });

  return new Response(null, { status: 204 });
}
