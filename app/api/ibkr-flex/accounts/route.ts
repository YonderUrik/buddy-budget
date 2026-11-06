import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listIbkrFlexAccountStatuses } from "@/lib/ibkr-flex";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Connection badges of the broker cash accounts fed by Interactive Brokers Flex (status fields only, like Trade Republic). */
export const GET = withRoute("ibkr_flex.accounts.list", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await listIbkrFlexAccountStatuses(session.user.id), { headers: { "Cache-Control": "private, no-store" } });
});
