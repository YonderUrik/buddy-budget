import { after, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isTrustedWriteOrigin } from "@/lib/http/same-origin";
import { rejectIfDemoActive } from "@/lib/start/demo";
import { resolveProfile } from "@/lib/localization/config";
import { bindRequestUser, recordIbkrFlexRequest, requestLogger, withRoute } from "@/lib/observability";
import { connectIbkrFlex, ibkrFlexAvailability, listIbkrFlexConnections, prepareIbkrFlexSync, runIbkrFlexSyncJob } from "@/lib/ibkr-flex";
import { redisRateWindowStore } from "@/lib/ibkr-flex/connections";
import { ibkrFlexConnectSchema } from "@/lib/validation/ibkr-flex";

/** The connect check generates a report (IBKR can take a minute); the import itself runs in `after()`. */
export const maxDuration = 300;
const privateHeaders = { "Cache-Control": "private, no-store" };
/** Connect attempts per user in a 15-minute window: each one costs IBKR requests under a shared limit. */
const CONNECT_ATTEMPTS = 5;

/** The user's IBKR Flex connections (status only: never the token or query id) and whether connecting is available. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const availability = ibkrFlexAvailability();
  return Response.json({ ...availability, connections: await listIbkrFlexConnections(session.user.id) }, { headers: privateHeaders });
}

/** Check the token and query with a short report, store the connection, then import the history in the background. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const userId = session.user.id;
  bindRequestUser(userId);
  if (!isTrustedWriteOrigin(request)) return new Response(null, { status: 403 });
  const demoBlock = await rejectIfDemoActive(userId, resolveProfile(session.user).language);
  if (demoBlock) return demoBlock;
  if (!ibkrFlexAvailability().configured) return Response.json({ reason: "unavailable_here" }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 1024) return new Response(null, { status: 413 });
  const parsed = ibkrFlexConnectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ reason: "invalid_input", field: parsed.error.issues[0]?.path[0] ?? null }, { status: 400 });
  const window = Math.floor(Date.now() / 900_000);
  if (await redisRateWindowStore.increment(`ibkr-flex:connect:${userId}:${window}`, 900) > CONNECT_ATTEMPTS) return Response.json({ reason: "rate_limited" }, { status: 429 });
  const log = requestLogger();
  const started = performance.now();
  const outcome = await connectIbkrFlex(userId, parsed.data);
  if (outcome.status === "refused") {
    recordIbkrFlexRequest("connect", outcome.reason, performance.now() - started);
    log.warn("ibkr_flex.connect.refused", { reason: outcome.reason, count: outcome.sections?.length ?? 0 });
    return Response.json({ reason: outcome.reason, sections: outcome.sections ?? [] }, { status: outcome.reason === "rate_limited" ? 429 : outcome.reason === "unavailable" || outcome.reason === "timeout" ? 503 : 422 });
  }
  recordIbkrFlexRequest("connect", "success", performance.now() - started);
  log.info("ibkr_flex.connect.succeeded", { connectionId: outcome.connectionId, outcome: outcome.reconnected ? "reconnected" : "created", periodHonoured: outcome.periodHonoured });
  const prepared = await prepareIbkrFlexSync(userId, outcome.connectionId, "initial-import");
  if (prepared.status === "started") after(() => runIbkrFlexSyncJob(userId, outcome.connectionId, prepared.job.id));
  return Response.json({ connectionId: outcome.connectionId, reconnected: outcome.reconnected, jobId: prepared.status === "started" ? prepared.job.id : null }, { status: 201, headers: privateHeaders });
}

export const GET = withRoute("ibkr_flex.connections.list", handleGet);
export const POST = withRoute("ibkr_flex.connections.create", handlePost);
