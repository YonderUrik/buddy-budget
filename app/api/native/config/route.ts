import { nativeSignInConfigFromEnv } from "@/lib/auth/social-providers";
import { withRoute } from "@/lib/observability";

/** Public sign-in configuration for the phone app (Google client ids, whether Apple is on): no secrets, no session. */
async function handleGet() {
  return Response.json(nativeSignInConfigFromEnv(process.env), { headers: { "Cache-Control": "public, max-age=300" } });
}

export const GET = withRoute("native.config", handleGet, { quietOnSuccess: true });
