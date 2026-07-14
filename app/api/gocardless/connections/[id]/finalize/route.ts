import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "@/lib/gocardless/redis-rate-limit-store";
import { syncAccountLink, type SyncableLink } from "@/lib/gocardless/sync";
import { finalizeSelectionSchema } from "@/lib/validation/gocardless";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const { id } = await params;
  const [connection] = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.id, id), eq(bankConnections.userId, session.user.id)));
  if (!connection) return new Response(null, { status: 404 });

  const body = await request.json();
  const parsed = finalizeSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const linksToSync: SyncableLink[] = [];

  for (const selection of parsed.data.selections) {
    if (selection.mode === "existing") {
      if (!selection.existingAccountId) {
        return Response.json({ error: "existingAccountId richiesto per mode 'existing'" }, { status: 400 });
      }

      // L'account selezionato deve appartenere all'utente della sessione, altrimenti un utente
      // potrebbe ricollegare (e quindi dirottare il sync) il conto "auto" di un altro utente.
      const [ownedAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.id, selection.existingAccountId),
            eq(accounts.userId, session.user.id),
            eq(accounts.source, "auto")
          )
        );
      if (!ownedAccount) {
        return Response.json({ error: "Conto non trovato" }, { status: 404 });
      }

      const [updatedLink] = await db
        .update(bankAccountLinks)
        .set({ connectionId: connection.id, externalAccountId: selection.externalAccountId })
        .where(eq(bankAccountLinks.accountId, selection.existingAccountId))
        .returning();
      linksToSync.push({
        linkId: updatedLink.id,
        connectionId: connection.id,
        accountId: selection.existingAccountId,
        externalAccountId: selection.externalAccountId,
        userId: session.user.id,
      });
    } else {
      const [account] = await db
        .insert(accounts)
        .values({ userId: session.user.id, name: selection.name, type: selection.type, source: "auto" })
        .returning();
      const [link] = await db
        .insert(bankAccountLinks)
        .values({ connectionId: connection.id, accountId: account.id, externalAccountId: selection.externalAccountId })
        .returning();
      linksToSync.push({
        linkId: link.id,
        connectionId: connection.id,
        accountId: account.id,
        externalAccountId: selection.externalAccountId,
        userId: session.user.id,
      });
    }
  }

  for (const link of linksToSync) {
    await syncAccountLink(link, redisRateLimitStore);
  }

  return Response.json({ ok: true }, { status: 201 });
}
