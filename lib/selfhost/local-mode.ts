/** Environment settings shared by setup validation, runtime guards and the local session endpoint. */
type Environment = Record<string, string | undefined>;

export const LOCAL_OWNER_ID = "buddybudget-local-owner";
export const LOCAL_OWNER_EMAIL = "local@buddybudget.invalid";
export const LOCAL_ENTRY_PATH = "/api/auth/selfhost-local";

/** Local access is opt-in and is never enabled on the hosted service. */
export function isLocalMode(env: Environment = process.env): boolean {
  return env.SELF_HOSTED === "true" && env.SELFHOST_AUTH_MODE === "local";
}

/** Refuse local mode if publishing configuration could expose automatic access. */
export function validateLocalMode(env: Environment): void {
  if (env.SELFHOST_AUTH_MODE && !["local", "server"].includes(env.SELFHOST_AUTH_MODE)) throw new Error("Invalid SELFHOST_AUTH_MODE.");
  if (env.SELFHOST_AUTH_MODE !== "local") return;
  let url: URL;
  try { url = new URL(env.APP_URL || ""); } catch { throw new Error("Local mode requires a loopback APP_URL."); }
  if (!isLocalMode(env) || env.APP_BIND !== "127.0.0.1" || url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || env.BETTER_AUTH_URL !== env.APP_URL) {
    throw new Error("Local mode requires SELF_HOSTED=true, APP_BIND=127.0.0.1 and matching http://localhost or http://127.0.0.1 app/auth URLs. Use server mode for network access.");
  }
}

/** Reject DNS rebinding and cross-site requests before allowing automatic local access. */
export function isLocalRequest(request: Request, env: Environment = process.env): boolean {
  try {
    validateLocalMode(env);
    if (!isLocalMode(env)) return false;
    const expected = new URL(env.APP_URL!);
    if (request.headers.get("host") !== expected.host) return false;
    const origin = request.headers.get("origin");
    if (origin && origin !== expected.origin) return false;
    const site = request.headers.get("sec-fetch-site");
    return !site || site === "same-origin" || site === "none";
  } catch { return false; }
}
