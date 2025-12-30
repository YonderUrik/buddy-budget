import * as Sentry from "@sentry/nextjs";

import { commonIgnoreErrors, shouldIgnoreError } from "@/lib/sentry/filters";

Sentry.init({
  // DSN from environment variable
  dsn: process.env.SENTRY_DSN,

  // === SAMPLING RATES ===
  sampleRate: 0.75, // 75% of errors
  tracesSampleRate: 0.2, // 20% of transactions

  // === ENVIRONMENT ===
  environment: process.env.NODE_ENV || "development",
  enabled: process.env.NODE_ENV === "production",

  // === PERFORMANCE MONITORING ===
  integrations: [
    // HTTP integration for tracing requests
    Sentry.httpIntegration(),
  ],

  // === ERROR FILTERING ===
  ignoreErrors: [
    ...commonIgnoreErrors,

    // Database connection errors (temporary)
    "ECONNREFUSED",
    "ETIMEDOUT",
    "connection timeout",

    // Prisma query timeouts (user-specific, not app-breaking)
    "Transaction timeout",
    "Query timeout",

    // NextAuth specific errors (users canceling auth)
    "OAuthCallbackError",
    "Callback error",

    // MongoDB errors that are user-specific
    "duplicate key error",
    "MongoServerError: E11000",
  ],

  beforeSend(event, hint) {
    const error = hint.originalException;

    // Apply custom filtering
    if (shouldIgnoreError(error)) {
      return null;
    }

    // Scrub sensitive data from event
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-api-key"];
      }

      // Remove sensitive query params
      if (
        event.request.query_string &&
        typeof event.request.query_string === "string"
      ) {
        event.request.query_string = event.request.query_string
          .replace(/token=\S+/gi, "token=[REDACTED]")
          .replace(/api_key=\S+/gi, "api_key=[REDACTED]");
      }
    }

    // Scrub sensitive data from extra context
    if (event.extra) {
      if (event.extra.body && typeof event.extra.body === "string") {
        try {
          const body = JSON.parse(event.extra.body);

          delete body.password;
          delete body.token;
          delete body.apiKey;
          event.extra.body = JSON.stringify(body);
        } catch {
          // Not JSON, leave as-is
        }
      }
    }

    return event;
  },

  // === RELEASE TRACKING ===
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version,

  // === DEBUG ===
  debug: false,
});
