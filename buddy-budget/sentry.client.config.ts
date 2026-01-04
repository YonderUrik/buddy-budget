import * as Sentry from "@sentry/nextjs";

import { commonIgnoreErrors, shouldIgnoreError } from "@/lib/sentry/filters";

Sentry.init({
  // DSN from environment variable
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,

  // === SAMPLING RATES (Optimized for Free Tier) ===

  // Error sampling: 75% of errors sent
  // With <1k users/month, expect ~50-200 errors/month
  sampleRate: 0.75,

  // Performance monitoring: 20% of transactions
  // Free tier: 10k transactions/month, 20% should keep us well under
  tracesSampleRate: 0.2,

  // Replay: DISABLED per requirements
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // === ENVIRONMENT ===
  environment: process.env.NODE_ENV || "development",

  // Only send errors in production (optional, remove to capture in dev)
  enabled: process.env.NODE_ENV === "production",

  // === PERFORMANCE MONITORING ===
  integrations: [
    // Browser tracing for performance
    Sentry.browserTracingIntegration(),
  ],

  // === AGGRESSIVE ERROR FILTERING ===

  // Common browser errors to ignore
  ignoreErrors: [
    ...commonIgnoreErrors,

    // ResizeObserver errors (browser quirks)
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",

    // Network errors (user connectivity issues)
    "Network request failed",
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    "cancelled",

    // Browser extension errors
    "top.GLOBALS",
    "chrome-extension://",
    "moz-extension://",
    "safari-extension://",

    // Ad blockers
    "adsbygoogle",
    "_AutofillCallbackHandler",

    // Navigation errors (user-initiated)
    "Navigation cancelled",
    "Navigation interrupted",

    // Hydration errors (usually not critical)
    "Hydration failed",
    "There was an error while hydrating",
  ],

  // Ignore errors from third-party scripts
  denyUrls: [
    // Google Analytics
    /https:\/\/www\.google-analytics\.com/i,
    /https:\/\/www\.googletagmanager\.com/i,

    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,

    // Social media widgets
    /connect\.facebook\.net/i,
    /platform\.twitter\.com/i,
  ],

  // Custom error filtering
  beforeSend(event, hint) {
    const error = hint.originalException;

    // Apply custom filtering logic
    if (shouldIgnoreError(error)) {
      return null;
    }

    // Filter out errors from development tools
    if (event.request?.headers?.["user-agent"]?.includes("HeadlessChrome")) {
      return null;
    }

    // Scrub PII from error messages (extra safety)
    if (event.message) {
      event.message = event.message
        .replace(/email=[\w.-]+@[\w.-]+\.\w+/gi, "email=[REDACTED]")
        .replace(/password=\S+/gi, "password=[REDACTED]")
        .replace(/token=\S+/gi, "token=[REDACTED]");
    }

    return event;
  },

  // Custom breadcrumb filtering (reduce noise)
  beforeBreadcrumb(breadcrumb) {
    // Ignore console.log breadcrumbs
    if (breadcrumb.category === "console" && breadcrumb.level !== "error") {
      return null;
    }

    // Ignore fetch breadcrumbs for third-party domains
    if (
      breadcrumb.category === "fetch" &&
      breadcrumb.data?.url &&
      typeof window !== "undefined" &&
      !breadcrumb.data.url.includes(window.location.hostname)
    ) {
      return null;
    }

    return breadcrumb;
  },

  // === RELEASE TRACKING ===
  // Automatically set by Vercel, or use package.json version
  release:
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.npm_package_version,

  // === DEBUG ===
  debug: false, // Set to true for verbose logging during setup
});
