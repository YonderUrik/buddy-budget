/**
 * lib/native — barrel file
 *
 * Glue between the web app and the native shell (Capacitor, `mobile/`): detection of the shell, deep links,
 * `.well-known` app-link files, in-app browser, push registration, biometric lock and native sign-in. Every plugin is
 * loaded with a dynamic `import()` only inside the app, so the web bundle does not grow.
 * Spec: docs/superpowers/specs/2026-10-17-native-app-capacitor-design.md.
 */

export { NATIVE_URL_SCHEME, resolveDeepLink, safeAppPath } from "./deep-link";
export { NATIVE_APP_LINK_PATHS, androidAssetLinks, appleAppSiteAssociation, nativeAppLinkConfigFromEnv } from "./app-links";
export type { NativeAppLinkConfig } from "./app-links";
export { nativePlatform, isNativeUserAgent, NATIVE_USER_AGENT_MARKER } from "./shell";
export type { NativePlatform } from "./shell";
export { openExternalPage, closeExternalPage } from "./browser";
export { enablePushOnThisDevice, refreshPushRegistration, forgetPushOnThisDevice, hasPushOnThisDevice } from "./push";
export type { PushEnableResult } from "./push";
export { biometricAvailability, verifyWithBiometrics, BIOMETRIC_LOCK_KEY, BIOMETRIC_GRACE_MS } from "./biometric";
export type { BiometricKind } from "./biometric";
export { nativeSocialSignIn, loadNativeAuthConfig } from "./social-sign-in";
export type { NativeAuthConfig, NativeSignInProvider, NativeSignInResult } from "./social-sign-in";
export { closeTopLayer } from "./layers";
