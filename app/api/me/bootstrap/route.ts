import { NextRequest } from "next/server";
import { buildMeBootstrap, meBootstrapSchema } from "@/lib/account/bootstrap";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { withRoute } from "@/lib/observability";

/**
 * Launch state of the signed-in user for the native apps: profile, the account gate to show (deactivated, legal
 * re-acceptance, onboarding) and the country capability map. The proxy lets it through every account gate.
 */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  return Response.json(meBootstrapSchema.parse(buildMeBootstrap(session)), { headers: { "Cache-Control": "no-store" } });
}

export const GET = withRoute("me.bootstrap", handleGet);
