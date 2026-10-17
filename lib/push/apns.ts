import { connect, constants, type ClientHttp2Session } from "node:http2";
import type { ApnsConfig } from "./config";
import { signJwt } from "./jwt";
import type { PushMessage, PushSendOutcome } from "./types";

/** Apple rejects provider tokens refreshed more often than every 20 minutes and older than one hour. */
const PROVIDER_TOKEN_TTL_MS = 40 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

let cachedToken: { keyId: string; token: string; expiresAt: number } | null = null;
const sessions = new Map<string, ClientHttp2Session>();

function providerToken(config: ApnsConfig, now = Date.now()): string {
  if (cachedToken && cachedToken.keyId === config.keyId && cachedToken.expiresAt > now) return cachedToken.token;
  const token = signJwt({ algorithm: "ES256", key: config.key, header: { kid: config.keyId }, claims: { iss: config.teamId, iat: Math.floor(now / 1000) } });
  cachedToken = { keyId: config.keyId, token, expiresAt: now + PROVIDER_TOKEN_TTL_MS };
  return token;
}

/** One HTTP/2 connection per APNs host, reused across sends and closed when idle or broken. */
function session(host: string): ClientHttp2Session {
  const existing = sessions.get(host);
  if (existing && !existing.closed && !existing.destroyed) return existing;
  const created = connect(`https://${host}`);
  created.setTimeout(60_000, () => created.close());
  const forget = () => {
    if (sessions.get(host) === created) sessions.delete(host);
  };
  created.on("close", forget);
  created.on("error", forget);
  sessions.set(host, created);
  return created;
}

/** APNs reasons that mean the device token is dead or not for this app. */
const DEAD_TOKEN_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);

/** Sends one notification to one iOS device through APNs (HTTP/2, token-based auth). */
export function sendApns(config: ApnsConfig, deviceToken: string, message: PushMessage): Promise<PushSendOutcome> {
  return new Promise((resolve) => {
    let request;
    try {
      request = session(config.host).request({
        [constants.HTTP2_HEADER_METHOD]: "POST",
        [constants.HTTP2_HEADER_PATH]: `/3/device/${encodeURIComponent(deviceToken)}`,
        authorization: `bearer ${providerToken(config)}`,
        "apns-topic": config.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });
    } catch {
      resolve("failed");
      return;
    }
    let status = 0;
    let body = "";
    request.setEncoding("utf8");
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.close(constants.NGHTTP2_CANCEL));
    request.on("response", (headers) => {
      status = Number(headers[constants.HTTP2_HEADER_STATUS] ?? 0);
    });
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("error", () => resolve("failed"));
    request.on("close", () => {
      if (status === 200) return resolve("sent");
      let reason: string | undefined;
      try {
        reason = (JSON.parse(body) as { reason?: string }).reason;
      } catch {
        reason = undefined;
      }
      resolve(status === 410 || (reason && DEAD_TOKEN_REASONS.has(reason)) ? "invalid_token" : "failed");
    });
    request.end(JSON.stringify({ aps: { alert: { title: message.title, body: message.body }, sound: "default" }, path: message.path }));
  });
}
