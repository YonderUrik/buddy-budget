# Frontend performance (RUM) + Umami retention/funnel

Date: 2026-09-28

## Goal

The user noticed two gaps in observability after the VPS migration: (1) Umami shows only the `app.buddybudget.io` domain as a traffic source, not the real production domain too; (2) no user-perceived performance metrics (Web Vitals), no funnel/retention configured. This spec covers the second part (the first is already solved: verified live that `www.buddybudget.io/stats/script.js` and `/stats/api/send` respond 200, the IngressRoute already covers all domains since commit `0ee8559`, Phase 7 — the absence in Umami is just little real traffic accumulated since yesterday or the cosmetic "Domain" field in the site settings, not a code/infra problem).

Replay and heatmaps are explicitly deferred (they would require a new tool in the cluster, e.g. self-hosted PostHog — more surface with banking data at stake, to be evaluated separately).

## Starting state

- `<Analytics />` from `@vercel/analytics` in [app/layout.tsx](../../app/layout.tsx) sends data to the Vercel network: since Phase 7 (2026-09-27) the app runs on k3s, no longer Vercel — it has probably done nothing useful since then. No check of residual functioning attempted (impossible without access to the Vercel Analytics dashboard, which the user has stopped paying for anyway).
- Existing application observability (Phase A/B, `docs/superpowers/specs/2026-09-27-osservabilita-app-fase-a-design.md`): `lib/observability/metrics.ts` (prom-client, `buddybudget_` prefix), `withRoute` for every route, Grafana dashboards/alerts as code in the `buddy-budget-infra` repo (`argocd/apps/grafana.yaml`), runbooks for alerts in `docs/runbooks/`.
- Self-hosted Umami (Phase 6) already tracks product events via `lib/analytics/track.ts` (`ProductEvents`), including the whole onboarding funnel: `onboarding_completed`, `bank_connect_started`, `bank_connect_completed`.

## Decisions

1. **Remove `@vercel/analytics`** (package + `<Analytics />` + import in `app/layout.tsx`): dead code after the migration, no 1:1 replacement needed because RUM replaces it.
2. **Custom RUM on Prometheus/Grafana**, not on Umami: Umami events are counts/categories, they don't do percentiles over duration distributions well (p75 is the Web Vitals standard). A new histogram per metric, the same alert/dashboard stack already in use.
3. **Core Web Vitals only** (LCP, CLS, INP) — not FCP/TTFB: they are the three Google uses for a page's "good/needs improvement/poor" assessment, enough to understand whether the app is perceived as slow.
4. **Retention/funnel**: no code. The onboarding funnel uses events already tracked; Umami's Retention report is native on pageviews. Only configuration in the Umami UI, documented as an operational runbook (not a plan task — the user does it whenever they want, without blocking the rest).
5. **Grafana alerts from the start** (not just dashboards): Google's standard thresholds (p75 LCP > 2.5s, INP > 200ms, CLS > 0.1) sustained over a window, `warning` severity on `#bb-avvisi` — same pattern as `bb-latenza-alta`.

## Architecture

### Client: collection and sending

New component `components/analytics/web-vitals-reporter.tsx` (same pattern as `PwaInstallTracker`, client component rendering null, mounted in `app/layout.tsx` in place of `<Analytics />`):

- `web-vitals` library (new dependency, ~1KB gzip), `onLCP`/`onCLS`/`onINP` with default options (final value per pageview, not every intermediate change).
- Each callback sends `navigator.sendBeacon('/api/rum', JSON.stringify({ metric, value, page, rating }))`, with a `fetch(..., { keepalive: true })` fallback if `sendBeacon` is unavailable or rejects the payload.
- `page` is not the raw `pathname`: `resolveRumPage(pathname)` maps it to a static whitelist of known routes (`/panoramica`, `/conti`, `/transazioni`, `/cash-flow`, `/investimenti`, `/categorie`, `/categorizza`, `/style-guide`, `/login`, `/onboarding`), fallback `"altro"` ("other"). Same caution as `withRoute`: never an arbitrary caller value in a metric label (cardinality and injection).
- No sampling: this app's real traffic is low (single user/a few), there's no need to reduce event volume.

### Server: collection

New route `app/api/rum/route.ts`:

- `POST`, public (no session check — metrics for `/login`, a pre-authentication page, are needed too), `withRoute("rum.report", handler, { quietOnSuccess: true })`.
- Body validated with Zod: `metric` enum `"LCP" | "CLS" | "INP"`, `value` positive number, `page` string (one of the values in the server-side whitelist, same list as `resolveRumPage` — a value outside the whitelist is a 400, it never ends up in a label).
- No DB writes, no personal data: calls `recordWebVital(metric, page, value)` and responds `204`.

### Metrics (`lib/observability/metrics.ts`)

Three new histograms, `page` label, following the existing pattern (`MetricsState`, `createState`, dedicated buckets as `DURATION_BUCKETS_SECONDS` already does for HTTP):

- `webVitalsLcpSeconds` — buckets `[0.5, 1, 1.8, 2.5, 3, 4, 5, 8]` (Google thresholds: good ≤2.5s, poor >4s).
- `webVitalsInpSeconds` — buckets `[0.05, 0.1, 0.2, 0.3, 0.5, 1]` (good ≤200ms, poor >500ms).
- `webVitalsClsScore` — buckets `[0.05, 0.1, 0.15, 0.25, 0.4, 0.6, 1]` (good ≤0.1, poor >0.25; dimensionless, not seconds).

Function `recordWebVital(metric: "LCP" | "CLS" | "INP", page: string, value: number)`: LCP/INP arrive from `web-vitals` in milliseconds → `/1000` before `.observe()`; CLS is already dimensionless, no conversion.

### Grafana (`buddy-budget-infra` repo)

- New dashboard `argocd/manifests/grafana-dashboards/dashboards/performance.json` (same pattern as `app.json`/`sync.json`: one ConfigMap per topic), uid `bb-performance`: p75 LCP/INP per page (`histogram_quantile(0.75, sum by (le, page) (rate(buddybudget_web_vitals_..._bucket[$__rate_interval])))`), CLS distribution, each panel with a description in Italian (normal value + what to do), same style as the existing dashboards.
- 3 new rules in `argocd/apps/grafana.yaml` (`alerting.rules.yaml`, existing `buddybudget` group): `bb-lcp-lento`, `bb-inp-lento`, `bb-cls-instabile`. Google thresholds above, window `for: 30m` (consistent with the low traffic cardinality, avoids false positives from a single slow visit), `severity: warning`, `noDataState: OK` (no visits in 30 minutes is not a problem), dedicated runbook `docs/runbooks/performance-lenta.md` (infra repo), dashboard link `bb-performance`.

### Umami retention/funnel (no code)

Documented as an operational runbook in `docs/osservabilita.md` (infra repo), new section "Funnel e retention utenti" ("User funnel and retention"):

- **Onboarding funnel**: Umami → Report → Funnel → steps `onboarding_completed` → `bank_connect_started` → `bank_connect_completed` (events already sent by `lib/analytics/track.ts`, no change needed).
- **Retention**: Umami → Report → Retention, no configuration required (native report on pageviews).

## Tests

- `resolveRumPage`: maps every known route, fallback `"altro"` on unrecognized paths — pure function, tested like the project's other route/whitelist utilities.
- `recordWebVital`: ms→s conversion for LCP/INP, passthrough for CLS, the right histogram for each `metric` (pattern of `lib/observability/metrics.test.ts`).
- `/api/rum` route: valid payload → 204 and histogram updated; `metric`/`page` outside the enum → 400, no spurious label written; no DB test (the route doesn't touch the DB).

## Out of scope (explicit)

- Session replay, heatmaps: deferred, a new tool is needed (e.g. self-hosted PostHog) — to be brainstormed separately if/when the user asks.
- RUM sampling: not needed at the current traffic volume, to be revisited if the app grows.
- FCP/TTFB: not tracked in this phase, can be added in the future with the same scheme (new histogram + `web-vitals` callback) if a specific need emerges.
