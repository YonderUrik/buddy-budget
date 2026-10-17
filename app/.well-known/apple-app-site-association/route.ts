import { withRoute } from "@/lib/observability";
import { appleAppSiteAssociation, nativeAppLinkConfigFromEnv } from "@/lib/native";

/** Tells iOS which app paths open the BuddyBudget app (Universal Links). 404 until `NATIVE_IOS_APP_ID` is set. */
async function handleGet() {
  const body = appleAppSiteAssociation(nativeAppLinkConfigFromEnv());
  if (!body) return new Response(null, { status: 404 });
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}

export const GET = withRoute("native.apple_app_site_association", handleGet, { quietOnSuccess: true });
