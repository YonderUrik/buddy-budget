import { after, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isTrustedWriteOrigin } from "@/lib/http/same-origin";
import { prepareTradeRepublicSync, runTradeRepublicSync } from "@/lib/trade-republic";
import { bindRequestUser, withRoute } from "@/lib/observability";

export const maxDuration = 300;
/** Ownership and the account lock are checked before returning the background job. */
export const POST = withRoute("trade_republic.accounts.sync", async (request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  if (!isTrustedWriteOrigin(request)) return new Response(null, { status: 403 });
  const { accountId } = await params;
  const result = await prepareTradeRepublicSync(session.user.id, accountId);
  if (result.status !== "started") return Response.json({ status: result.status }, { status: result.status === "not-found" ? 404 : result.status === "expired" ? 410 : 409 });
  after(() => runTradeRepublicSync(session.user.id, accountId, result.job.id));
  return Response.json({ jobId: result.job.id }, { status: 202 });
});
