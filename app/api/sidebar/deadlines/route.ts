import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { loadSidebarDeadlines } from "@/lib/sidebar/deadlines";

/** Prossime scadenze per la sidebar: rate dei finanziamenti e collegamenti bancari da rinnovare. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await loadSidebarDeadlines(session.user.id));
}

export const GET = withRoute("sidebar.deadlines", handleGet, { quietOnSuccess: true });
