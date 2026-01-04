/**
 * Common errors to ignore across all Sentry configurations
 */
export const commonIgnoreErrors = [
  // Browser-specific errors
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",

  // Network errors (user connectivity)
  "Network request failed",
  "NetworkError",
  "Failed to fetch",
  "Load failed",
  "ERR_INTERNET_DISCONNECTED",
  "ERR_NETWORK_CHANGED",

  // Timeout errors (user-specific)
  "timeout of 0ms exceeded",
  "Request aborted",
  "Request cancelled",

  // Browser extension errors
  "top.GLOBALS",
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",

  // Third-party scripts
  "Script error.",
  "Non-Error promise rejection captured",

  // Ad blockers
  "adsbygoogle",
  "_AutofillCallbackHandler",

  // React hydration (usually harmless)
  "Hydration failed",
  "There was an error while hydrating",
  "Text content does not match",

  // User-initiated navigation
  "Navigation cancelled",
  "Navigation interrupted",
  "Load cancelled",
];

/**
 * Custom error filtering logic
 * Returns true if error should be ignored
 */
export function shouldIgnoreError(error: unknown): boolean {
  if (!error) return false;

  const errorString = String(error);
  const errorMessage = error instanceof Error ? error.message : errorString;

  // Ignore errors from browser extensions
  if (
    errorMessage.includes("chrome-extension://") ||
    errorMessage.includes("moz-extension://") ||
    errorMessage.includes("safari-extension://")
  ) {
    return true;
  }

  // Ignore errors from ad blockers
  if (
    errorMessage.includes("adsbygoogle") ||
    errorMessage.includes("google_ad") ||
    errorMessage.includes("blocked by client")
  ) {
    return true;
  }

  // Ignore network errors (user connectivity)
  if (
    errorMessage.includes("NetworkError") ||
    errorMessage.includes("Failed to fetch") ||
    errorMessage.includes("ERR_NETWORK") ||
    errorMessage.includes("ERR_INTERNET_DISCONNECTED")
  ) {
    return true;
  }

  // Ignore React 18 hydration errors (usually non-critical)
  if (
    errorMessage.includes("Hydration") ||
    errorMessage.includes("did not match")
  ) {
    return true;
  }

  // Ignore third-party script errors
  if (errorMessage === "Script error." || errorMessage.includes("Non-Error")) {
    return true;
  }

  return false;
}

/**
 * Check if an error is likely a user error (not app bug)
 * Used for lower priority tagging
 */
export function isUserError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Form validation errors
  if (
    errorMessage.includes("validation") ||
    errorMessage.includes("invalid input") ||
    errorMessage.includes("required field")
  ) {
    return true;
  }

  // Authentication errors (user not logged in)
  if (
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("not authenticated") ||
    errorMessage.includes("session expired")
  ) {
    return true;
  }

  // Rate limiting (user-specific)
  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("too many requests")
  ) {
    return true;
  }

  return false;
}
