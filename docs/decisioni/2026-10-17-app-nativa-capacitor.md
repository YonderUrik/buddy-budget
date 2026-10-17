# 2026-10-17 — Native app: Capacitor shell over the web app

Daniele wants BuddyBudget in the stores without rewriting it, done completely in one go. Chosen: a Capacitor shell
(`mobile/`) that loads `app.buddybudget.io`. Set aside: Expo/React Native (full UI rewrite, 3-5 months, every feature
twice), PWA only (no stores). Included: magic link, Google, Apple and bank flows that come back into the app, push
notifications (new `push_devices` table, email/phone channels), Face ID lock, Android back and status bar, icons,
splash, privacy manifest, CI builds. Every future feature must work inside the shell: rules in `CLAUDE.md`
("Mobile app (Capacitor)"). Design: `docs/superpowers/specs/2026-10-17-native-app-capacitor-design.md`.
