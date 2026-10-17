# 2026-10-17 — Public demo without an account, `latest` images

**Context**: the launch plan (Show HN, Product Hunt, GitHub Trending) found three blockers: no way to see the app without signing up, a landing only in Italian, and self-hosting images without the `latest` tag that `docker-compose.yml` uses by default.

**Decision**:
- `/demo?country=IT|DE&lang=it|en|de` (both optional) opens a shared, read-only sample account per supported country and language pair: Italy in Italian or English, Germany in English or German (`public-demo-<country>-<lang>`, four accounts; the country decides the tax and planning rules, the language the texts; the same data as the landing screenshots, `lib/public-demo/seed.ts`). The session lasts 2 hours and ends with the browser. Writes are refused in two places: `proxy.ts` (every non-GET `/api/*` call → 403 `demo_read_only` with a translated message) and a better-auth plugin hook (profile, email, password, sessions, linked accounts, deletion). A strip on every screen says it is the demo, with «Crea il tuo account», and a footer chooses country and language: each pair is its own account, so a change opens that account on the same page (`/demo?...&next=<page>`). The login page (also inside the Capacitor app, which loads the same pages) links it as «Prova la demo».
- The data is rebuilt every night by `/api/cron/public-demo` (dates move with today; whatever a visitor managed to change disappears). It is off unless `PUBLIC_DEMO_ENABLED=true`, so self-hosted instances never get demo accounts.
- Demo accounts never count as users (usage stats, last activity, auth metrics) and their invented securities stay out of the price cron.
- Every release now publishes `latest` for all three images; arm64 stays behind `SELFHOST_IMAGES`.

**Why shared accounts, not one per visitor**: no rows created per click (launch traffic could be thousands of visitors), nothing to clean up, and read-only makes sharing safe.

**Deferred**: per-visitor sandboxes where writes work, arm64 images by default (QEMU builds slow the deploy; native arm runners would need a split build).

**Signals**: `buddybudget_public_demo_events_total{event,language}` (session_started, unavailable, write_blocked, reset), cron heartbeat `public_demo`, logs `demo.session.*` and `demo.reset.*`, Umami `public_demo_viewed` and `public_demo_signup_clicked`.

## Landing conversion fixes (same PR)

- The landing's «sign up» buttons open the sign-in page with `signup=1`: it reads «Crea il tuo account» with a new-user line; «Entra» keeps the old wording.
- Every landing page has its own `og:title`, `og:url` and Twitter card (`landing/lib/page-metadata.ts`); the root layouts no longer set a canonical.
- Campaign parameters (`utm_*`) arriving on the landing are carried onto every link to the app (`UtmPassthrough`), kept as slugs in localStorage on the sign-in page and sent with `login_link_requested`, `google_login_started` and `onboarding_completed`.
