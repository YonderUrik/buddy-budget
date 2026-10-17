# Native app with Capacitor — design

Status: **implemented, not yet in the stores** (2026-10-17). Daniele asked for a native app without rewriting the
product, done fully in one go. Expo/React Native was weighed and set aside: it means rewriting 45 screens and ~420
domain components (estimated 3-5 months, and every feature built twice afterwards).

## Approach

A Capacitor 8 shell (`mobile/`) whose WebView loads `https://app.buddybudget.io` (`server.url`). Screens, API, auth,
deploy on k3s and release flow stay as they are; a web release reaches the app with no store review. The shell adds
the native pieces that make it worth installing (and that Apple review guideline 4.2 asks of "wrapped websites").

The WebView is a separate browser: its cookies are not shared with Safari/Chrome. Every flow that leaves the app
(email, Google, Apple, the bank) must therefore come back **into the WebView**, or the session ends up in the wrong place.

Every plugin is called from `lib/native/` through a dynamic `import()` behind `nativePlatform()`, so the web bundle
does not grow and the browser never loads native code. Plugin versions are pinned identically in `package.json` and
`mobile/package.json` (`lib/native/plugin-versions.test.ts`).

## Flows

| Flow | Problem in the shell | Solution |
|------|---------------------|----------|
| Magic link | The email link opens Safari, the session lands there | Universal Link / App Link on `/api/auth/magic-link/verify` (`/.well-known/*` from the `NATIVE_*` env); `NativeAppBridge` loads it in the WebView |
| Google | Google blocks OAuth in WebViews (`disallowed_useragent`) | `@capgo/capacitor-social-login` opens the system sheet → ID token → better-auth `signIn.social({ provider, idToken })`. `GOOGLE_IOS_CLIENT_ID` is a second accepted audience (`lib/auth/social-providers.ts`); the button is hidden in the app when the server has no Google client |
| Apple | Guideline 4.8: an app offering Google must offer Sign in with Apple | Same plugin, iPhone only; better-auth `apple` provider with `appBundleIdentifier` as audience (`APPLE_APP_BUNDLE_IDENTIFIER`); Apple sends the name only the first time, passed with the token |
| Bank (GoCardless, PSD2) | Banks refuse WebViews; the callback needs the session cookie | The consent opens in the in-app browser (`Browser.open`); the requisition redirect is `/api/gocardless/app-return` (`client: "app"`), a public page that opens `buddybudget://open?path=/api/gocardless/callback?…`; the bridge closes the browser and runs the callback in the WebView. Cleanup recognises both return URLs as ours |
| Deep links | A crafted link could make the app call an endpoint | `safeAppPath` accepts same-origin paths only, and of `/api/*` only the magic-link verify and the bank callback |
| Android back button | Closes the app at every press | `closeTopLayer` closes the topmost open dialog/sheet/menu (Escape), else history back, else exit |
| Status bar and safe areas | Content under the notch and the bars | Edge to edge on both platforms (`contentInset: never`, `SystemBars.insetsHandling: css`); the web pads with `env(safe-area-inset-*)` (0 in browsers); light icons on the navy mobile top bar (`data-status-bar="on-dark"`) and in dark theme |
| Offline | Blank WebView | `www/offline.html` with «Riprova» |
| Sign-out | The next account on the phone would get the previous one's push | `signOutThisDevice()` removes this phone's token first |

## Native features

- **Push notifications**: table `push_devices` (token unique, platform, last seen; migration 0041, number to recheck
  at merge), `GET/POST/DELETE /api/user/push-devices`, `POST /api/user/push-devices/test` (shares the hourly limit of
  the test email). Channels on `notification_preferences`: `email_enabled` (default true, as before) and
  `push_enabled` (default false). The notifications cron sends each kind on the chosen channels and claims the
  dedup keys once; push text never contains amounts (`lib/notifications/push-messages.ts`) and opens the right screen.
  Sending (`lib/push/`) uses only `node:crypto`/`node:http2`: FCM HTTP v1 with a service-account JWT, APNs with a
  `.p8` token (cached 40 min). Invalid tokens are deleted; phones unseen for 90 days are purged by the cron.
- **Face ID / fingerprint lock**: opt-in per phone in Impostazioni → «Questo telefono» (confirmed with Face ID when
  turned on); locks at cold start and after more than 30 s in the background; covers the screen in the app switcher.
  A convenience lock, not a security boundary (the session is the server's).
- **Icons, splash, privacy manifest**: generated from the brand mark (`pnpm assets`); `PrivacyInfo.xcprivacy` declares
  no tracking and the data types of the privacy policy.
- **Versioning and signing**: `mobile/package.json` follows the app release (release-please extra file); iOS via
  `scripts/sync-version.mjs`, Android in `build.gradle` (versionCode = major·10⁶ + minor·10³ + patch); Android release
  signing from `keystore.properties` or env.
- **CI**: `.github/workflows/mobile.yml` (types, generated files committed, Android debug APK, iOS simulator build).

## Decided not to do now

- Bundling the web app inside the binary (no offline mode): the app uses Server Components and Route Handlers, a
  static export is not possible, and a remote `server.url` keeps one release flow.
- Push for price alerts and investment events: they are emails sent outside the notifications cron today.
- Home-screen widget (SwiftUI WidgetKit / Android Glance), haptics, share sheet for the ZIP export.
- Signed store builds in CI (needs certificates as GitHub secrets): by hand for the first releases.
- In-app purchases: the service is free. If Pro is sold, Apple requires its in-app purchase for digital subscriptions
  bought in the app (with EU/US exceptions to verify then).

## Open questions

- Apple review of a remote-URL shell: the native features are the argument; to verify with the first TestFlight.
- Universal Links on the bank return (cross-domain redirect from the bank) are unreliable, hence the custom scheme.
- Push text is Italian, like the emails, until notifications are localised.

## Observability

- Logs: `push.device.registered|removed`, `notifications.push.sent|failed|dry_run`, `push.test.sent`,
  `gocardless.app_return.served`, `gocardless.connection.started` with `platform` (web/app).
- Metric `buddybudget_push_notifications_total{kind,platform,outcome}` (sent, failed, invalid_token, dry_run,
  not_configured); alert and panel in the infra repo.
- Umami: `native_link_opened`, `native_notification_opened`, `native_sign_in` (provider, outcome),
  `native_bank_consent_opened`, `push_notifications_toggled`, `email_notifications_toggled`, `push_test_sent`,
  `biometric_lock_toggled`, `biometric_unlocked`.
- `withRoute` names: `native.config`, `native.apple_app_site_association`, `native.asset_links`,
  `gocardless.app_return`, `user.push_devices.get|register|remove|test`.
- Share of app traffic: `BuddyBudgetApp` user agent suffix.
