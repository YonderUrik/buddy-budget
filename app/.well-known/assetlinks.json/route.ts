import { withRoute } from "@/lib/observability";
import { androidAssetLinks, nativeAppLinkConfigFromEnv } from "@/lib/native";

/** Tells Android which app may open BuddyBudget links (App Links). 404 until package and certificate are set. */
async function handleGet() {
  const body = androidAssetLinks(nativeAppLinkConfigFromEnv());
  if (!body) return new Response(null, { status: 404 });
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}

export const GET = withRoute("native.asset_links", handleGet, { quietOnSuccess: true });
