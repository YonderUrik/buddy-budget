import { nativePlatform } from "./shell";

/** Where the app remembers the token it registered, to unregister it at sign-out. */
const PUSH_TOKEN_KEY = "bb:native:push-token";
/** Time allowed to the OS to hand over a token (APNs/FCM). */
const REGISTRATION_TIMEOUT_MS = 15_000;

export type PushEnableResult = "enabled" | "denied" | "unavailable" | "failed";

function storedToken(): string | null {
  try {
    return window.localStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(PUSH_TOKEN_KEY, token);
    else window.localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // Storage blocked: the token is re-registered at the next launch anyway.
  }
}

/** Asks the OS for a push token (APNs on iOS, FCM on Android). */
async function obtainToken(): Promise<string> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  return new Promise<string>((resolve, reject) => {
    const handles: Promise<{ remove: () => Promise<void> }>[] = [];
    const done = (fn: () => void) => {
      window.clearTimeout(timer);
      handles.forEach((handle) => void handle.then((h) => h.remove()));
      fn();
    };
    const timer = window.setTimeout(() => done(() => reject(new Error("push registration timeout"))), REGISTRATION_TIMEOUT_MS);
    handles.push(PushNotifications.addListener("registration", ({ value }) => done(() => resolve(value))));
    handles.push(PushNotifications.addListener("registrationError", (error) => done(() => reject(new Error(error.error)))));
    void PushNotifications.register().catch((error: unknown) => done(() => reject(error)));
  });
}

async function saveToken(platform: string, token: string): Promise<boolean> {
  const response = await fetch("/api/user/push-devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform, token }) });
  if (response.ok) storeToken(token);
  return response.ok;
}

/**
 * Turns on notifications on this phone: asks the permission (once: after a refusal only the system settings can
 * change it), gets the token and saves it on the account. Outside the app returns `unavailable`.
 */
export async function enablePushOnThisDevice(): Promise<PushEnableResult> {
  const platform = nativePlatform();
  if (!platform) return "unavailable";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") return "denied";
    return (await saveToken(platform, await obtainToken())) ? "enabled" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * At every launch of the app: if notifications were already allowed, refreshes the token on the account (tokens can
 * rotate, and the server prunes devices it has not seen for months). Never asks for permission.
 */
export async function refreshPushRegistration(): Promise<void> {
  const platform = nativePlatform();
  if (!platform || !storedToken()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    if ((await PushNotifications.checkPermissions()).receive !== "granted") return;
    await saveToken(platform, await obtainToken());
  } catch {
    // Offline or provider not configured: retried at the next launch.
  }
}

/** Forgets this phone on the account (sign-out, phone switch turned off). Silent when nothing was registered. */
export async function forgetPushOnThisDevice(): Promise<void> {
  const token = storedToken();
  if (!token) return;
  try {
    await fetch("/api/user/push-devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
  } finally {
    storeToken(null);
  }
}

/** True if this phone has registered a token (the switch shows the state of this device, not of the account). */
export function hasPushOnThisDevice(): boolean {
  return storedToken() !== null;
}
