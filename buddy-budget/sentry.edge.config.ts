import * as Sentry from "@sentry/nextjs";

import { commonIgnoreErrors } from "@/lib/sentry/filters";

Sentry.init({
  // DSN from environment variable
  dsn: process.env.SENTRY_DSN,

  // === SAMPLING RATES ===
  sampleRate: 0.5, // Lower for edge (more frequent calls)
  tracesSampleRate: 0.1, // 10% for edge (middleware runs on every request)

  // === ENVIRONMENT ===
  environment: process.env.NODE_ENV || "development",
  enabled: process.env.NODE_ENV === "production",

  // === ERROR FILTERING ===
  ignoreErrors: [
    ...commonIgnoreErrors,

    // Middleware-specific errors
    "NextAuth",
    "Session expired",
    "Invalid session",

    // Redirect errors (normal flow)
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],

  beforeSend(event) {
    // Edge runtime has limited context, apply minimal filtering

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }

    return event;
  },

  // === RELEASE TRACKING ===
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version,

  debug: false,
});
