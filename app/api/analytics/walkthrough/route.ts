import { NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { markWalkthroughSeen } from "@/lib/analitiche/data";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/** Segna la guida iniziale di Analitiche come vista (completata o chiusa). */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  await markWalkthroughSeen(session.user.id);
  requestLogger().info("analytics.walkthrough.seen");
  return new Response(null, { status: 204 });
}

export const POST = withRoute("analytics.walkthrough.seen", handlePost);
