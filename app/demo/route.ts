import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { requestLogger, withRoute } from "@/lib/observability";
import { safeRedirectPath } from "@/lib/auth/constants";
import { isPublicDemoUserId, pickPublicDemoProfile } from "@/lib/public-demo/config";

export const dynamic = "force-dynamic";

/** Where a visitor lands once the demo session exists (unless `?next=` names a page), and where a real signed-in user is sent instead. */
const DEMO_HOME_PATH = "/";
/** Where the visitor goes when the demo is switched off or not seeded yet. */
const DEMO_FALLBACK_PATH = "/login";

/**
 * Absolute address of an app page. Behind the ingress `request.url` carries the container's bind address
 * (`0.0.0.0:3000`), so redirects are built from the public `APP_URL` instead.
 */
function publicUrl(path: string): URL {
  return new URL(path, `${getAppUrl()}/`);
}

/**
 * `GET /demo[?country=IT|DE][&lang=it|en|de][&next=/path]`: opens the read-only public demo in one hop, from the landing's
 * «Prova la demo» and from the demo's own language and country chooser (`next` keeps the page the visitor was on).
 * A real signed-in user is never signed out: they just go to their own app.
 */
async function handleGet(request: NextRequest) {
  const existing = await auth.api.getSession({ headers: request.headers });
  if (existing && !isPublicDemoUserId(existing.user.id)) {
    return NextResponse.redirect(publicUrl(DEMO_HOME_PATH));
  }
  const params = request.nextUrl.searchParams;
  const { language, productCountry } = pickPublicDemoProfile(params.get("country"), params.get("lang"), request.headers.get("accept-language"));
  const landing = params.get("next") ? safeRedirectPath(params.get("next")) : DEMO_HOME_PATH;
  try {
    const { headers } = await auth.api.signInPublicDemo({ body: { language, productCountry }, headers: request.headers, returnHeaders: true });
    const response = NextResponse.redirect(publicUrl(landing));
    for (const cookie of headers.getSetCookie()) response.headers.append("set-cookie", cookie);
    return response;
  } catch (error) {
    // Disabled or not seeded: the plugin already logged and counted it; the visitor sees the normal sign-in page.
    requestLogger().info("demo.session.redirected", { language, country: productCountry, reason: error instanceof Error ? error.message.slice(0, 40) : "unknown" });
    return NextResponse.redirect(publicUrl(DEMO_FALLBACK_PATH));
  }
}

export const GET = withRoute("demo.open", handleGet);
