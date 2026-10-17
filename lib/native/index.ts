/**
 * lib/native — barrel file
 *
 * Glue between the web app and the native shell (Capacitor, `mobile/`): deep links, `.well-known` app-link files,
 * detection of the shell. Spec: docs/superpowers/specs/2026-10-17-native-app-capacitor-design.md.
 */

export { NATIVE_URL_SCHEME, resolveDeepLink } from "./deep-link";
export { NATIVE_APP_LINK_PATHS, androidAssetLinks, appleAppSiteAssociation, nativeAppLinkConfigFromEnv } from "./app-links";
export type { NativeAppLinkConfig } from "./app-links";
export { nativeShell } from "./shell";
export type { NativeAppPlugin } from "./shell";
