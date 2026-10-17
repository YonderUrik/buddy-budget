import type { FcmConfig } from "./config";
import { signJwt } from "./jwt";
import type { PushMessage, PushSendOutcome } from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
/** Google access tokens last one hour: refreshed a bit earlier. */
const ACCESS_TOKEN_TTL_MS = 50 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

let cached: { projectId: string; token: string; expiresAt: number } | null = null;

async function accessToken(config: FcmConfig, now = Date.now()): Promise<string> {
  if (cached && cached.projectId === config.projectId && cached.expiresAt > now) return cached.token;
  const issuedAt = Math.floor(now / 1000);
  const assertion = signJwt({
    algorithm: "RS256",
    key: config.privateKey,
    claims: { iss: config.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: issuedAt, exp: issuedAt + 3600 },
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`FCM OAuth ${response.status}`);
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("FCM OAuth without access_token");
  cached = { projectId: config.projectId, token: body.access_token, expiresAt: now + ACCESS_TOKEN_TTL_MS };
  return body.access_token;
}

/** FCM error codes that mean the registration token is dead (app uninstalled, token rotated). */
const DEAD_TOKEN_CODES = new Set(["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"]);

/** Sends one notification to one Android device through the FCM HTTP v1 API. */
export async function sendFcm(config: FcmConfig, token: string, message: PushMessage): Promise<PushSendOutcome> {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(config)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: message.title, body: message.body },
        data: { path: message.path },
        android: { priority: "high" },
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.ok) return "sent";
  const body = (await response.json().catch(() => null)) as { error?: { status?: string; details?: { errorCode?: string }[] } } | null;
  const codes = [body?.error?.status, ...(body?.error?.details ?? []).map((d) => d.errorCode)];
  return response.status === 404 || codes.some((code) => code && DEAD_TOKEN_CODES.has(code)) ? "invalid_token" : "failed";
}

/** Test hook: forgets the cached access token. */
export function resetFcmTokenCache(): void {
  cached = null;
}
