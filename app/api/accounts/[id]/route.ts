import { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/http";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { z } from "zod";
import { AccountDeletionError, deleteAccountWithData } from "@/lib/liquidity/account-deletion.server";
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
 * Deletes or unlinks one of the user's accounts, manual or linked; 404 if not theirs. An account an import created takes
 * its portfolio, operations, statements and uploaded files with it (`deleteAccountWithData`): then the body must carry
 * the `token` of `GET /api/accounts/[id]/deletion`. If it was the last account of a bank connection, the consent is
 * revoked on GoCardless right away and the slot frees up.
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
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "account_not_found", "Conto non trovato");
  const body = z.object({ token: z.string().max(128).optional() }).safeParse(await request.json().catch(() => ({})));
  if (!body.success) return validationError(body.error);

  const links = await db
    .select({ connectionId: bankAccountLinks.connectionId })
    .from(bankAccountLinks)
    .where(eq(bankAccountLinks.accountId, id));

  try {
    const removed = await deleteAccountWithData(session.user.id, id, body.data.token);
    requestLogger().info("accounts.account.deleted", { count: removed.cashCount, deleted: removed.investmentCount });
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      if (error.status === 404) return apiError(404, "account_not_found", error.message);
      requestLogger().warn("accounts.account.delete_conflict", {});
      return apiError(409, "account_deletion_changed", error.message);
    }
    throw error;
  }

  // After the transaction: the link went with the account (cascade). Never throws; at worst the daily cleanup handles it.
  for (const { connectionId } of links) await releaseConnectionIfUnused(connectionId, "account_removed", requestLogger());

  return new Response(null, { status: 204 });
}

export const PATCH = withRoute("accounts.update", handlePatch);
export const DELETE = withRoute("accounts.delete", handleDelete);
