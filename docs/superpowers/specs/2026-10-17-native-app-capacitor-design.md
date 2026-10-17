# Native app with Capacitor — design

Status: **sketch** (2026-10-17). Daniele asked for a native app without rewriting the product. Expo/React Native was
weighed and set aside for now: it means rewriting 45 screens and ~420 domain components (estimated 3-5 months, and
every feature built twice afterwards).

## Approach

A Capacitor shell (`mobile/`) whose WebView loads `https://app.buddybudget.io` (`server.url`). Screens, API, auth,
deploy on k3s and release flow stay as they are; a web release reaches the app with no store review. The shell adds
the native pieces that make it worth installing (and that Apple review guideline 4.2 asks of "wrapped websites").

The WebView is a separate browser: its cookies are not shared with Safari/Chrome. Every flow that leaves the app
(email, Google, the bank) must therefore come back **into the WebView**, or the session ends up in the wrong place.

## Flows

| Flow | Problem in the shell | Solution | Phase |
|------|---------------------|----------|-------|
| Magic link | The email link opens Safari, the session lands there | Universal Link / App Link on `/api/auth/magic-link/verify`; `NativeAppBridge` loads it in the WebView | 1 (in the sketch) |
| Google | Google blocks OAuth in WebViews (`disallowed_useragent`); in Safari the session lands outside the app | Native Google Sign-In (plugin) → ID token → better-auth `signIn.social({ provider: "google", idToken })`; iOS/Android client IDs added to the accepted audiences. Until then «Continua con Google» must be hidden in the shell (not done in the sketch) | 2 |
| Bank (GoCardless, PSD2) | The bank page opens outside the WebView; the callback needs the session cookie | Requisition redirect with `?client=app`; when the callback has no session and the flag is set it answers `buddybudget://open?path=/api/gocardless/callback?ref=…`, the app catches it and replays it in the WebView. Note: `unknownRequisitionOrigin` compares the redirect URL exactly (`lib/gocardless/cleanup-plan.ts`), so it must accept the variant | 2 |
| Android back button | Closes the app at every press | `NativeAppBridge` goes back in history, exits on the first screen; later: close open sheets first | 1 (in the sketch) |
| Offline | Blank WebView | `www/offline.html` with «Riprova» | 1 (in the sketch) |

## Native features (phase 3)

- Push notifications (APNs/FCM): device tokens table + endpoint, sent by the existing notification cron next to the
  emails (due dates, budget, price alerts, goals). Needs a migration and an opt-in in Impostazioni → Notifiche.
- Face ID / fingerprint lock on open (`@capacitor-community/biometric-auth` or similar), opt-in.
- Status bar and haptics; share sheet for the ZIP export.
- Later: home-screen widget with net worth (native code: SwiftUI WidgetKit / Android Glance, reading a small API).

## Phases

1. **Shell + magic link** (this sketch): `mobile/`, `.well-known` files, `NativeAppBridge`, offline page.
2. **Google and bank** in the shell, hide Google until it works; TestFlight and Play internal testing.
3. **Push + Face ID**, store listing (screenshots, privacy labels: same data as the privacy policy), review.

## Decided not to do now

- Bundling the web app inside the binary (no offline mode): the app uses Server Components and Route Handlers, a
  static export is not possible, and a remote `server.url` keeps one release flow.
- In-app purchases: the service is free. If Pro is sold, Apple requires its in-app purchase for digital subscriptions
  bought in the app (with EU/US exceptions to verify then).

## Open questions

- Apple review of a remote-URL shell: phase 3 features are the argument; to verify with the first TestFlight submission.
- Universal Links on the bank return (cross-domain redirect from the bank) are unreliable, hence the custom scheme.

## Observability

- `native_link_opened` Umami event (`kind`: accesso/pagina, `platform`).
- `.well-known` routes through `withRoute` (`native.apple_app_site_association`, `native.asset_links`), quiet on success.
- Share of app traffic: `BuddyBudgetApp` user agent suffix (Umami shows it under devices/browsers).
