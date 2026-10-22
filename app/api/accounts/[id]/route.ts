import { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/http";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { bankAccountLinks } from "@/lib/db/schema/bank-connections";
import { releaseConnectionIfUnused } from "@/lib/gocardless/release";
import { updateAccountSchema } from "@/lib/validation/accounts";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

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
async function handlePatch(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const { id } = await params;
  const account = await getOwnedAccount(session.user.id, id);
  if (!account) {
    return apiError(404, "account_not_found", "Conto non trovato");
  }

  const body = await request.json();
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  if (account.source === "auto" && ("type" in parsed.data || "balance" in parsed.data)) {
    return apiError(403, "linked_account_read_only", "Per un conto collegato automaticamente tipo e saldo non sono modificabili");
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

/**
 * Elimina o scollega un conto del proprio utente, manuale o auto; 404 se non proprio. Se era l'ultimo conto
 * di un collegamento bancario, il consenso viene revocato subito su GoCardless e il posto si libera.
 */
async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const { id } = await params;
  const account = await getOwnedAccount(session.user.id, id);
  if (!account) {
    return apiError(404, "account_not_found", "Conto non trovato");
  }

  // transactions.account_id non ha ON DELETE cascade (a differenza di bank_account_links):
  // un conto "auto" con transazioni sincronizzate violerebbe altrimenti il vincolo FK.
  const links = await db
    .select({ connectionId: bankAccountLinks.connectionId })
    .from(bankAccountLinks)
    .where(eq(bankAccountLinks.accountId, id));

  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(eq(transactions.accountId, id));
    await tx.delete(accounts).where(eq(accounts.id, id));
  });

  // Dopo la transazione: il link è sparito con il conto (cascade). Non lancia mai, al peggio resta alla pulizia giornaliera.
  for (const { connectionId } of links) await releaseConnectionIfUnused(connectionId, "account_removed", requestLogger());

  return new Response(null, { status: 204 });
}

export const PATCH = withRoute("accounts.update", handlePatch);
export const DELETE = withRoute("accounts.delete", handleDelete);
