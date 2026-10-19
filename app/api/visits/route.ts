import { NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { withRoute } from "@/lib/observability";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { touchVisit } from "@/lib/welcome/visit.server";
import { logVisitStart } from "@/lib/welcome/visit-log.server";

/**
 * POST /api/visits — heartbeat from the open app (layout): keeps the current visit alive and starts a new one after a
 * pause (see `lib/welcome/visit.ts`). Answers `{ newVisit }`, so the client re-reads the «Dall'ultima visita» summary.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  // The shared demo account has no visits of its own (and the proxy refuses its writes anyway).
  if (isPublicDemoUserId(session.user.id)) return Response.json({ newVisit: false });
  const touch = await touchVisit(session.user.id);
  if (touch) logVisitStart(touch, "heartbeat");
  return Response.json({ newVisit: touch?.newVisit ?? false });
}

export const POST = withRoute("visits.heartbeat", handlePost, { quietOnSuccess: true });
