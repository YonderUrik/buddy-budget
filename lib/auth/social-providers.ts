/**
 * Social sign-in providers built from the environment. Pure (no `server-only`), so it is testable and shared by the
 * better-auth config and by `GET /api/native/config`.
 *
 * - Google: on with `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. `GOOGLE_IOS_CLIENT_ID` adds the iOS client as an
 *   accepted ID-token audience, for the native sign-in sheet in the iPhone app (Android tokens carry the web client id).
 * - Apple: on with `APPLE_APP_BUNDLE_IDENTIFIER` (audience of the ID tokens from the iPhone app). `APPLE_CLIENT_ID` and
 *   `APPLE_CLIENT_SECRET` (Services ID and its signed secret) are only needed for a future web "Sign in with Apple".
 */
export interface SocialProviderEnv {
  [name: string]: string | undefined;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
}

export interface SocialProvidersConfig {
  google?: { clientId: string | string[]; clientSecret: string };
  apple?: { clientId: string; clientSecret: string; appBundleIdentifier: string };
}

/** Public sign-in configuration for the native app: client ids are not secrets. */
export interface NativeSignInConfig {
  google: { webClientId: string; iosClientId: string | null } | null;
  apple: boolean;
}

function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Providers for `betterAuth({ socialProviders })`; an empty object leaves only the magic link. */
export function socialProvidersFromEnv(env: SocialProviderEnv): SocialProvidersConfig {
  const config: SocialProvidersConfig = {};
  const googleId = present(env.GOOGLE_CLIENT_ID);
  const googleSecret = present(env.GOOGLE_CLIENT_SECRET);
  if (googleId && googleSecret) {
    const iosId = present(env.GOOGLE_IOS_CLIENT_ID);
    // The first id is the one used for the web redirect; the others are only accepted as ID-token audiences.
    config.google = { clientId: iosId ? [googleId, iosId] : googleId, clientSecret: googleSecret };
  }
  const bundleId = present(env.APPLE_APP_BUNDLE_IDENTIFIER);
  if (bundleId) {
    config.apple = {
      clientId: present(env.APPLE_CLIENT_ID) ?? bundleId,
      clientSecret: present(env.APPLE_CLIENT_SECRET) ?? "",
      appBundleIdentifier: bundleId,
    };
  }
  return config;
}

/** What the native app needs to open the Google and Apple sheets. */
export function nativeSignInConfigFromEnv(env: SocialProviderEnv): NativeSignInConfig {
  const providers = socialProvidersFromEnv(env);
  const googleIds = providers.google ? [providers.google.clientId].flat() : [];
  return {
    google: googleIds[0] ? { webClientId: googleIds[0], iosClientId: googleIds[1] ?? null } : null,
    apple: Boolean(providers.apple),
  };
}
