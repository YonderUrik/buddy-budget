import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listTradeRepublicConnections } from "@/lib/trade-republic";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** List only safe status fields for the authenticated person's direct bank connections. */
export const GET = withRoute("trade_republic.connections.list", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await listTradeRepublicConnections(session.user.id), { headers: { "Cache-Control": "private, no-store" } });
});
