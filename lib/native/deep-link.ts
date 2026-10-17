/** Custom URL scheme of the native app (Capacitor shell in `mobile/`): `buddybudget://open?path=/liquidita`. */
export const NATIVE_URL_SCHEME = "buddybudget";

/**
 * Turns a URL the native app was opened with into a same-origin path for the WebView, or null when it must be ignored.
 * Two forms are accepted: a Universal/App Link on the app's own origin (magic link in the email,
 * `https://app.buddybudget.io/api/auth/magic-link/verify?token=…`) and the custom scheme used where a Universal Link
 * cannot fire (`buddybudget://open?path=/api/gocardless/callback?ref=…`). Anything else (another host, a protocol-relative
 * `//evil.com` path) returns null, so a crafted link can never move the WebView off the app.
 */
export function resolveDeepLink(rawUrl: string, appOrigin: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol === `${NATIVE_URL_SCHEME}:`) {
    if (url.hostname !== "open") return null;
    return safeAppPath(url.searchParams.get("path"));
  }

  if (url.origin !== new URL(appOrigin).origin) return null;
  return safeAppPath(`${url.pathname}${url.search}${url.hash}`);
}

/**
 * API endpoints a deep link may open: they finish a flow that left the app (magic link, bank consent). Any other
 * `/api/…` path is refused, so a link on a web page cannot make the app call an endpoint on the person's behalf.
 */
export const DEEP_LINK_API_PATHS = ["/api/auth/magic-link/verify", "/api/gocardless/callback"] as const;

/** Path on the app's own origin: starts with a single "/" (no `//host`, no backslash tricks), API paths only from the list above. */
export function safeAppPath(candidate: string | null): string | null {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return null;
  const pathname = candidate.split(/[?#]/, 1)[0];
  if ((pathname === "/api" || pathname.startsWith("/api/")) && !DEEP_LINK_API_PATHS.some((allowed) => pathname === allowed)) return null;
  return candidate;
}
