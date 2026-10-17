# 2026-10-17 — Public demo without an account, `latest` images

**Context**: the launch plan (Show HN, Product Hunt, GitHub Trending) found three blockers: no way to see the app without signing up, a landing only in Italian, and self-hosting images without the `latest` tag that `docker-compose.yml` uses by default.

**Decision**:
- `/demo?lang=it|en|de` opens a shared, read-only sample account per language (`public-demo-<lang>`, the same data as the landing screenshots, `lib/public-demo/seed.ts`). The session lasts 2 hours and ends with the browser. Writes are refused in two places: `proxy.ts` (every non-GET `/api/*` call → 403 `demo_read_only` with a translated message) and a better-auth plugin hook (profile, email, password, sessions, linked accounts, deletion). A strip on every screen says it is the demo, with «Crea il tuo account». The login page (also inside the Capacitor app, which loads the same pages) links it as «Prova la demo».
- The data is rebuilt every night by `/api/cron/public-demo` (dates move with today; whatever a visitor managed to change disappears). It is off unless `PUBLIC_DEMO_ENABLED=true`, so self-hosted instances never get demo accounts.
- Demo accounts never count as users (usage stats, last activity, auth metrics) and their invented securities stay out of the price cron.
- Every release now publishes `latest` for all three images; arm64 stays behind `SELFHOST_IMAGES`.

**Why shared accounts, not one per visitor**: no rows created per click (launch traffic could be thousands of visitors), nothing to clean up, and read-only makes sharing safe.

**Deferred**: per-visitor sandboxes where writes work, arm64 images by default (QEMU builds slow the deploy; native arm runners would need a split build).

**Signals**: `buddybudget_public_demo_events_total{event,language}` (session_started, unavailable, write_blocked, reset), cron heartbeat `public_demo`, logs `demo.session.*` and `demo.reset.*`, Umami `public_demo_viewed` and `public_demo_signup_clicked`.
