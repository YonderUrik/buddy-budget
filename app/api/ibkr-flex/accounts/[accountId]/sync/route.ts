import { after, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isTrustedWriteOrigin } from "@/lib/http/same-origin";
import { ibkrFlexConnectionForAccount, prepareIbkrFlexSync, runIbkrFlexSyncJob } from "@/lib/ibkr-flex";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

export const maxDuration = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sync from an account row (`/api/{provider}/accounts/{id}/sync`, as for banks): the account's connection, if it is the user's. */
export const POST = withRoute("ibkr_flex.accounts.sync", async (request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const userId = session.user.id;
  bindRequestUser(userId);
  if (!isTrustedWriteOrigin(request)) return new Response(null, { status: 403 });
  const { accountId } = await params;
  const connectionId = UUID.test(accountId) ? await ibkrFlexConnectionForAccount(userId, accountId) : null;
  if (!connectionId) return Response.json({ status: "not-found" }, { status: 404 });
  const result = await prepareIbkrFlexSync(userId, connectionId, "manual-sync");
  if (result.status !== "started") return Response.json({ status: result.status }, { status: result.status === "not-found" ? 404 : result.status === "expired" ? 410 : 409 });
  requestLogger().info("ibkr_flex.sync.started", { connectionId, trigger: "account" });
  after(() => runIbkrFlexSyncJob(userId, connectionId, result.job.id));
  return Response.json({ jobId: result.job.id }, { status: 202 });
});
