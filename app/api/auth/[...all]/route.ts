import { isLocalMode, localRequestRejection } from "@/lib/selfhost";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { logger, recordAuthEvent, withRoute } from "@/lib/observability";

const handlers = toNextJsHandler(auth);

/** Path of the password sign-in endpoint (under /api/auth). */
const PASSWORD_SIGN_IN_PATH = "/api/auth/sign-in/email";

/** Counts the refusals of better-auth's built-in rate limiter and wrong passwords (better-auth has no hook for either). */
function countRateLimited(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (isLocalMode()) {
      const rejection = localRequestRejection(request);
      const endpoint = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
      const reason = rejection ?? (["/selfhost-local", "/get-session", "/sign-out"].includes(endpoint) ? null : "endpoint");
      if (reason) {
        logger.warn("selfhost.local_request.rejected", { reason });
        return new Response(null, { status: 403 });
      }
    }
    const response = await handler(request);
    if (response.status === 429) recordAuthEvent("rate_limited");
    else if (response.status === 401 && new URL(request.url).pathname === PASSWORD_SIGN_IN_PATH) recordAuthEvent("password_sign_in_failed");
    return response;
  };
}

// Un solo nome di route per tutte le sotto-route di better-auth: il path reale non va nelle etichette.
export const GET = withRoute("auth", countRateLimited(handlers.GET));
export const POST = withRoute("auth", countRateLimited(handlers.POST));
