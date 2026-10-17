/**
 * Paths that open the native app instead of the browser (Universal Links on iOS, App Links on Android).
 * Only the magic link for now: the email is read on the phone, and the session must land in the app's WebView,
 * which does not share cookies with Safari or Chrome.
 */
export const NATIVE_APP_LINK_PATHS = ["/api/auth/magic-link/verify"] as const;

/** Configuration of the store apps, from env: without it the `.well-known` files answer 404 (web-only deploys, self-hosting). */
export interface NativeAppLinkConfig {
  /** `<TEAM_ID>.<bundle id>`, e.g. `ABCDE12345.io.buddybudget.app` (`NATIVE_IOS_APP_ID`). */
  iosAppId?: string;
  /** Android application id, e.g. `io.buddybudget.app` (`NATIVE_ANDROID_PACKAGE`). */
  androidPackage?: string;
  /** SHA-256 fingerprints of the signing certificates, comma-separated (`NATIVE_ANDROID_CERT_SHA256`). */
  androidCertSha256?: string;
}

/** Reads the configuration from the environment; empty strings count as missing. */
export function nativeAppLinkConfigFromEnv(env: Record<string, string | undefined> = process.env): NativeAppLinkConfig {
  const value = (key: string) => env[key]?.trim() || undefined;
  return {
    iosAppId: value("NATIVE_IOS_APP_ID"),
    androidPackage: value("NATIVE_ANDROID_PACKAGE"),
    androidCertSha256: value("NATIVE_ANDROID_CERT_SHA256"),
  };
}

/** Body of `/.well-known/apple-app-site-association`, or null when the iOS app is not configured. */
export function appleAppSiteAssociation(config: NativeAppLinkConfig): object | null {
  if (!config.iosAppId) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: [config.iosAppId],
          components: NATIVE_APP_LINK_PATHS.map((path) => ({ "/": path })),
        },
      ],
    },
  };
}

/** Body of `/.well-known/assetlinks.json`, or null when the Android app is not configured. */
export function androidAssetLinks(config: NativeAppLinkConfig): object[] | null {
  const fingerprints = (config.androidCertSha256 ?? "").split(",").map((f) => f.trim()).filter(Boolean);
  if (!config.androidPackage || fingerprints.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: config.androidPackage, sha256_cert_fingerprints: fingerprints },
    },
  ];
}
