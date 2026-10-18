import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { GoCardlessError, getRequisition } from "@/lib/gocardless/client";
import { findUserConnection, loadConnectionAccounts } from "@/lib/gocardless/complete";
import { bindRequestUser, withRoute } from "@/lib/observability";

async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  const connection = await findUserConnection(session.user.id, id);
  if (!connection || !connection.requisitionId) {
    return new Response(null, { status: 404 });
  }

  try {
    const requisition = await getRequisition(connection.requisitionId);
    return Response.json(await loadConnectionAccounts(session.user.id, requisition.accounts));
  } catch (error) {
    if (error instanceof GoCardlessError) {
      return Response.json({ error: "Impossibile recuperare i conti dalla banca" }, { status: 502 });
    }
    throw error;
  }
}

export const GET = withRoute("gocardless.connections.accounts", handleGet);
