import * as Sentry from "@sentry/nextjs";

/**
 * Next.js Instrumentation API
 * Registers Sentry based on runtime environment
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only register in server/edge runtime, not in client
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side (Node.js) runtime
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime (middleware, edge functions)
    await import("./sentry.edge.config");
  }
}

/**
 * Capture errors from Server Components, middleware, and proxies
 */
export const onRequestError = Sentry.captureRequestError;
