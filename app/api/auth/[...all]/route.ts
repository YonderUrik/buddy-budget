import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { recordAuthEvent, withRoute } from "@/lib/observability";

const handlers = toNextJsHandler(auth);

/** Conta i rifiuti del rate limiter integrato di better-auth (che non espone un hook dedicato). */
function countRateLimited(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const response = await handler(request);
    if (response.status === 429) recordAuthEvent("rate_limited");
    return response;
  };
}

// Un solo nome di route per tutte le sotto-route di better-auth: il path reale non va nelle etichette.
export const GET = withRoute("auth", countRateLimited(handlers.GET));
export const POST = withRoute("auth", countRateLimited(handlers.POST));
