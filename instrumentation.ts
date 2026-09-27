/** Hook di boot Next.js: valida le variabili d'ambiente all'avvio del server (fallisce subito se ne manca una). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("@/lib/env");
    parseServerEnv(process.env);
  }
}

/**
 * Errori non intercettati da `withRoute` (Server Components, pagine, server action): una riga
 * `next.request_error` col template della route (mai il path reale, che può contenere query o id).
 */
export async function onRequestError(
  error: unknown,
  request: { method: string },
  context: { routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logger } = await import("@/lib/observability");
  logger.error("next.request_error", {
    route: context.routePath,
    method: request.method,
    reason: context.routeType,
    error,
  });
}
