import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { GoCardlessError, getAccountDetails, getRequisition } from "@/lib/gocardless/client";
import { bindRequestUser, withRoute } from "@/lib/observability";

async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  const [connection] = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.id, id), eq(bankConnections.userId, session.user.id)));
  if (!connection || !connection.requisitionId) {
    return new Response(null, { status: 404 });
  }

  try {
    const requisition = await getRequisition(connection.requisitionId);
    const externalAccounts = await Promise.all(
      requisition.accounts.map(async (externalAccountId) => ({
        externalAccountId,
        details: await getAccountDetails(externalAccountId),
      }))
    );

    const existingAutoAccounts = await db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.userId, session.user.id), eq(accounts.source, "auto")));

    return Response.json({ externalAccounts, existingAutoAccounts });
  } catch (error) {
    if (error instanceof GoCardlessError) {
      return Response.json({ error: "Impossibile recuperare i conti dalla banca" }, { status: 502 });
    }
    throw error;
  }
}

export const GET = withRoute("gocardless.connections.accounts", handleGet);
