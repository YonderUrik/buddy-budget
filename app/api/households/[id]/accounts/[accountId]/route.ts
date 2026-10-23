import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { loadHouseholdAccountTransactions } from "@/lib/households/data";
import { bindRequestUser, withRoute } from "@/lib/observability";

type Context = { params: Promise<{ id: string; accountId: string }> };

/** An account a member shows the group, with its latest transactions (read-only). */
async function handleGet(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id, accountId } = await params;
  const result = await loadHouseholdAccountTransactions(session.user.id, id, accountId);
  return result ? Response.json(result) : Response.json({ error: "Conto non trovato" }, { status: 404 });
}

export const GET = withRoute("households.account", handleGet);
