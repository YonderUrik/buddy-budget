import { nativePlatform } from "./shell";

/** Public sign-in configuration the native app needs (`GET /api/native/config`). OAuth client ids are not secrets. */
export interface NativeAuthConfig {
  /** Google: web client id (ID token audience) and iOS client id; null when Google sign-in is off on this server. */
  google: { webClientId: string; iosClientId: string | null } | null;
  /** Sign in with Apple is configured (iOS only). */
  apple: boolean;
}

export type NativeSignInProvider = "google" | "apple";

/** Result of the native sign-in sheet: the ID token to hand to better-auth, `cancelled` when the person closed it. */
export type NativeSignInResult = { idToken: string; name?: { firstName: string; lastName: string } } | "cancelled" | "failed";

let initialized: Promise<void> | null = null;

async function initialize(config: NativeAuthConfig): Promise<void> {
  initialized ??= (async () => {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({
      ...(config.google
        ? { google: { webClientId: config.google.webClientId, iOSClientId: config.google.iosClientId ?? undefined, iOSServerClientId: config.google.webClientId, mode: "online" as const } }
        : {}),
      ...(config.apple ? { apple: {} } : {}),
    });
  })().catch((error: unknown) => {
    initialized = null;
    throw error;
  });
  return initialized;
}

/** Whether a native sign-in error means the person closed the sheet (no error message then). */
function isCancellation(error: unknown): boolean {
  const text = String((error as { message?: string; code?: string })?.message ?? (error as { code?: string })?.code ?? error).toLowerCase();
  return /cancel|canceled|cancelled|12501|1001|dismiss/.test(text);
}

/**
 * Opens the system sign-in sheet of Google or Apple inside the native app and returns the ID token. Google blocks
 * its web sign-in inside WebViews, so in the app this replaces the redirect used on the web.
 */
export async function nativeSocialSignIn(provider: NativeSignInProvider, config: NativeAuthConfig): Promise<NativeSignInResult> {
  if (!nativePlatform()) return "failed";
  try {
    await initialize(config);
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    if (provider === "google") {
      const { result } = await SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"] } });
      const idToken = "idToken" in result ? result.idToken : null;
      return idToken ? { idToken } : "failed";
    }
    const { result } = await SocialLogin.login({ provider: "apple", options: { scopes: ["email", "name"] } });
    if (!result.idToken) return "failed";
    const { givenName, familyName } = result.profile;
    // Apple sends the name only the first time, outside the ID token: better-auth stores it with the new account.
    return givenName || familyName ? { idToken: result.idToken, name: { firstName: givenName ?? "", lastName: familyName ?? "" } } : { idToken: result.idToken };
  } catch (error) {
    return isCancellation(error) ? "cancelled" : "failed";
  }
}

/** Fetches the sign-in configuration (cached for the page's life: it changes only with a deploy). */
let configRequest: Promise<NativeAuthConfig> | null = null;
export function loadNativeAuthConfig(): Promise<NativeAuthConfig> {
  configRequest ??= fetch("/api/native/config")
    .then((response) => (response.ok ? (response.json() as Promise<NativeAuthConfig>) : { google: null, apple: false }))
    .catch(() => {
      configRequest = null;
      return { google: null, apple: false };
    });
  return configRequest;
}
