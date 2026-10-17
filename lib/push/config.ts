/** Credentials of Firebase Cloud Messaging (Android): from the service account JSON of the Firebase project. */
export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** Credentials of Apple Push Notification service (iOS): a token-based `.p8` key. */
export interface ApnsConfig {
  /** PEM of the `.p8` key. */
  key: string;
  keyId: string;
  teamId: string;
  /** Bundle id of the app (`apns-topic`). */
  bundleId: string;
  /** `api.push.apple.com` (TestFlight, App Store) or `api.sandbox.push.apple.com` (builds run from Xcode). */
  host: string;
}

export interface PushConfig {
  fcm: FcmConfig | null;
  apns: ApnsConfig | null;
}

const DEFAULT_BUNDLE_ID = "io.buddybudget.app";

/** Accepts a value pasted as is or base64-encoded (SOPS-friendly). */
function fromBase64IfEncoded(value: string): string {
  const trimmed = value.trim();
  return /^[A-Za-z0-9+/=\s]+$/.test(trimmed) ? Buffer.from(trimmed, "base64").toString("utf8") : trimmed;
}

/** A PEM key pasted as is, base64-encoded, or on one line with `\n` escaped. */
function decodePem(value: string): string {
  return (value.includes("-----") ? value.trim() : fromBase64IfEncoded(value)).replace(/\\n/g, "\n");
}

/**
 * Push credentials from the environment. Each platform is optional: without `FCM_SERVICE_ACCOUNT` Android devices get
 * nothing, without the `APNS_*` variables iOS devices get nothing (self-hosting, web-only deploys). Malformed values
 * count as missing, so a typo turns push off instead of crashing the cron.
 */
export function pushConfigFromEnv(env: Record<string, string | undefined> = process.env): PushConfig {
  return { fcm: fcmConfig(env), apns: apnsConfig(env) };
}

function fcmConfig(env: Record<string, string | undefined>): FcmConfig | null {
  const raw = env.FCM_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.startsWith("{") ? raw : fromBase64IfEncoded(raw)) as { project_id?: unknown; client_email?: unknown; private_key?: unknown };
    if (typeof parsed.project_id !== "string" || typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

function apnsConfig(env: Record<string, string | undefined>): ApnsConfig | null {
  const key = env.APNS_KEY?.trim();
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim();
  if (!key || !keyId || !teamId) return null;
  return {
    key: decodePem(key),
    keyId,
    teamId,
    bundleId: env.APNS_BUNDLE_ID?.trim() || DEFAULT_BUNDLE_ID,
    host: env.APNS_ENVIRONMENT?.trim() === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com",
  };
}
