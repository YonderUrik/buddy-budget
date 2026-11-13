import { after, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isTrustedWriteOrigin } from "@/lib/http/same-origin";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { prepareIbkrFlexSync, runIbkrFlexSyncJob } from "@/lib/ibkr-flex";

export const maxDuration = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Manual sync: ownership and the connection lock are checked here, the work runs in `after()` with visible progress. */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const userId = session.user.id;
  bindRequestUser(userId);
  if (!isTrustedWriteOrigin(request)) return new Response(null, { status: 403 });
  const { connectionId } = await params;
  if (!UUID.test(connectionId)) return new Response(null, { status: 404 });
  const result = await prepareIbkrFlexSync(userId, connectionId, "manual-sync");
  if (result.status !== "started") return Response.json({ status: result.status }, { status: result.status === "not-found" ? 404 : result.status === "expired" ? 410 : 409 });
  requestLogger().info("ibkr_flex.sync.started", { connectionId, trigger: "manual" });
  after(() => runIbkrFlexSyncJob(userId, connectionId, result.job.id));
  return Response.json({ jobId: result.job.id }, { status: 202 });
}

export const POST = withRoute("ibkr_flex.connections.sync", handlePost);
