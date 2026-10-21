import { isLocalMode, isLocalRequest } from "@/lib/selfhost";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { recordAuthEvent, withRoute } from "@/lib/observability";

const handlers = toNextJsHandler(auth);

/** Conta i rifiuti del rate limiter integrato di better-auth (che non espone un hook dedicato). */
function countRateLimited(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (isLocalMode()) {
      if (!isLocalRequest(request)) return new Response(null, { status: 403 });
      const endpoint = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
      if (!["/selfhost-local", "/get-session", "/sign-out"].includes(endpoint)) return new Response(null, { status: 403 });
    }
    const response = await handler(request);
    if (response.status === 429) recordAuthEvent("rate_limited");
    return response;
  };
}

// Un solo nome di route per tutte le sotto-route di better-auth: il path reale non va nelle etichette.
export const GET = withRoute("auth", countRateLimited(handlers.GET));
export const POST = withRoute("auth", countRateLimited(handlers.POST));
