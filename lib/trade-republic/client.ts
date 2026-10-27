/** Private Trade Republic web API adapter. Never expose cookies or provider responses to the browser. */
import { createHash } from "node:crypto";
import { describeError, tradeRepublicDebug } from "./debug";

const API_ORIGIN = "https://api.traderepublic.com";
const LOGIN_PATH = "/api/v2/auth/web/login";
const REQUEST_TIMEOUT_MS = 15_000;

export interface TradeRepublicSession {
  cookies: Record<string, string>;
  deviceId: string;
  processId?: string;
}
export interface TradeRepublicLoginState {
  status: "pending" | "confirmed";
  needsAuthenticator: boolean;
}

/** A deliberately generic error: upstream bodies can contain credentials and personal information. */
export class TradeRepublicError extends Error {
  constructor(public readonly reason: "expired" | "rate-limited" | "unavailable" | "invalid-response" | "unsupported-event" | "existing-import") {
    super(`Trade Republic: ${reason}`);
    this.name = "TradeRepublicError";
  }
}

/** Create an isolated server-side connection; the caller owns encrypted, short-lived session persistence. */
export function createTradeRepublicClient(session: TradeRepublicSession, fetcher: typeof fetch = fetch) {
  async function request(path: string, method = "GET", body?: unknown, expectJson = true): Promise<unknown> {
    const response = await fetcher(`${API_ORIGIN}${path}`, {
      method,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Referer: "https://app.traderepublic.com/",
        "User-Agent": process.env.TRADE_REPUBLIC_USER_AGENT || "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Accept-Language": "en",
        Origin: "https://app.traderepublic.com",
        "X-Tr-Platform": "web-pro",
        "X-TR-App-Version": process.env.TRADE_REPUBLIC_APP_VERSION || "2.2631.13",
        "X-TR-Device-Info": Buffer.from(JSON.stringify({ stableDeviceId: createHash("sha512").update(session.deviceId).digest("hex"), browser: "Chrome", browserVersion: "146.0.0.0", os: "Linux", osVersion: "", screen: "1920x1080x24", numberOfCores: 1, timezone: "Etc/UTC", timezoneOffset: 0, preferredLanguages: ["en"] })).toString("base64"),
        Cookie: Object.entries(session.cookies).map(([name, value]) => `${name}=${value}`).join("; "),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).catch(error => { tradeRepublicDebug("http.network_error", { method, path: debugPath(path), error: describeError(error) }); throw new TradeRepublicError("unavailable"); });
    tradeRepublicDebug("http.response", { method, path: debugPath(path), status: response.status, contentType: response.headers.get("content-type"), setCookies: response.headers.getSetCookie().length });
    if (!response.ok) {
      throw new TradeRepublicError(response.status === 429 ? "rate-limited" : response.status === 401 || response.status === 403 ? "expired" : "unavailable");
    }
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (!/^[\w-]+$/.test(name) || /[\r\n;]/.test(value)) { tradeRepublicDebug("http.invalid_cookie", { path: debugPath(path) }); throw new TradeRepublicError("invalid-response"); }
      if (value && !/;\s*max-age=0(?:;|$)/i.test(cookie)) session.cookies[name] = value;
      else delete session.cookies[name];
    }
    if (!expectJson || response.status === 204) return null;
    try { return await response.json(); }
    catch { tradeRepublicDebug("http.invalid_json", { method, path: debugPath(path) }); throw new TradeRepublicError("invalid-response"); }
  }
  function processPath(): string {
    if (!session.processId) throw new TradeRepublicError("expired");
    return `${LOGIN_PATH}/processes/${encodeURIComponent(session.processId)}`;
  }
  return {
    /** Refresh TR's authenticated session, retaining rotated cookies only on the server. */
    async refresh(): Promise<void> { await request("/api/v1/auth/web/session", "GET", undefined, false); },
    /** Read account identity directly, without downloading an export. */
    async account(): Promise<unknown> { return request("/api/v2/auth/account"); },
    /** Send credentials once; they are never retained in the session. */
    async login(phoneNumber: string, pin: string): Promise<void> {
      const result = await request(LOGIN_PATH, "POST", { phoneNumber, pin });
      if (!result || typeof result !== "object" || !("processId" in result) || typeof result.processId !== "string" || !result.processId) {
        throw new TradeRepublicError("invalid-response");
      }
      session.processId = result.processId;
    },
    /** Poll once, allowing HTTP requests to finish promptly while app approval is pending. */
    async loginState(): Promise<TradeRepublicLoginState> {
      const result = await request(processPath());
      if (!result || typeof result !== "object" || !("status" in result)) throw new TradeRepublicError("invalid-response");
      if (result.status !== "PENDING" && result.status !== "CONFIRMED" && result.status !== "COMPLETED" && result.status !== "APPROVED") throw new TradeRepublicError("expired");
      return { status: result.status === "PENDING" ? "pending" : "confirmed", needsAuthenticator: "requiredAction" in result && result.requiredAction === "AUTHENTICATOR_VERIFICATION" };
    },
    /** Complete the optional authenticator challenge without retaining the code. */
    async verifyAuthenticator(code: string): Promise<void> {
      await request(`${processPath()}/authenticator-verification`, "POST", { code });
    },
  };
}

/** Login process ids are one-use secrets: staging logs show the route only. */
function debugPath(path: string): string {
  return path.replace(/\/processes\/[^/]+/, "/processes/:id");
}
