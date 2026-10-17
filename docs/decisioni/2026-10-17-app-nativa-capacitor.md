# 2026-10-17 — Native app: Capacitor shell over the web app

Daniele wants BuddyBudget in the stores without rewriting it. Chosen: a Capacitor shell (`mobile/`) that loads
`app.buddybudget.io`, plus the native pieces the web cannot do. Set aside: Expo/React Native (full UI rewrite,
3-5 months, every feature twice), PWA only (no stores). First sketch: shell, magic link via Universal/App Links
(`/.well-known/*` from `NATIVE_*` env), `NativeAppBridge` (deep links, Android back), offline page.
Next: Google via native sign-in, bank return via `buddybudget://`, push, Face ID, store review.
Design: `docs/superpowers/specs/2026-10-17-native-app-capacitor-design.md`.
