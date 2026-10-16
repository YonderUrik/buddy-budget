# Frontend performance (RUM) + Umami retention/funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@vercel/analytics` (dead code after the VPS migration) with real Web Vitals (LCP/CLS/INP) collected client-side and reported as Prometheus histograms, visible in a new Grafana dashboard with alerts; document the configuration (UI, no code) of the onboarding funnel and retention in Umami.

**Architecture:** A `WebVitalsReporter` client component (`web-vitals` library) sends one beacon per metric to a new public route `POST /api/rum`, which validates the payload and writes to 3 new histograms in `lib/observability/metrics.ts` (the same Prometheus registry already exposed by `/api/metrics`). Infra repo: new Grafana dashboard as code + 3 alert rules in the existing group + runbook. The whitelist of trackable pages (`RUM_PAGES`) is shared between client and server to avoid cardinality/injection in the labels.

**Tech Stack:** Next.js App Router, `web-vitals` (new), prom-client (existing), Zod, Vitest, Grafana as code (`buddy-budget-infra` repo).

**Spec:** `docs/superpowers/specs/2026-09-28-performance-frontend-retention-design.md`

## Global Constraints

- Metric prefix: `buddybudget_` (`METRIC_PREFIX` in `lib/observability/metrics.ts`).
- Never an arbitrary caller value in a metric label: `page` is always one of the values of `RUM_PAGES`, checked both client-side (mapping) and server-side (Zod schema), never the raw pathname.
- Static route names for `withRoute` (never a path with ids): this route is called `"rum.report"`.
- Only Core Web Vitals (LCP, CLS, INP) — no FCP/TTFB in this round.
- No DB writes, no personal data in the RUM payload.
- Alert thresholds: Google standard values (LCP p75 > 2.5s, INP p75 > 200ms, CLS p75 > 0.1), severity `warning` → `#bb-avvisi`, same pattern as the `buddybudget` group in `argocd/apps/grafana.yaml`.
- Infra repo: `<percorso-repo-infra>` (path to the infra repo, a git repo separate from this one).

## Review Focus

- **Negative or non-numeric `value` in the `/api/rum` body** — a compromised client or a future bug in the library must not be able to write a histogram with an absurd value; the Zod schema must reject it with 400, not silently accept it or crash the route.
- **`page` outside the whitelist** (route not mapped yet, or tampered value) — must return 400, never end up as a free label in the histogram (cardinality/injection, same principle as `assertStaticRouteName`).
- **`metric` outside the `LCP`/`CLS`/`INP` enum** — must return 400, not be silently ignored nor mapped at random onto one of the three histograms.
- **Non-JSON or missing body** (`sendBeacon` blocked by extensions, unstable network) — the route must not throw an unhandled exception; same `.json().catch(() => null)` pattern already used elsewhere.
- **`sendBeacon` unavailable or refused** (old browser, blocklist) — the client component must have a fallback (`fetch` with `keepalive: true`) instead of silently losing all data.

---

## Task 1: Shared RUM page whitelist

**Files:**
- Create: `lib/analytics/rum-pages.ts`
- Test: `lib/analytics/rum-pages.test.ts`
- Modify: `lib/analytics/index.ts`

**Interfaces:**
- Consumes: nothing (pure function, no dependency on other tasks).
- Produces: `RUM_PAGES: readonly string[]`, `type RumPage = (typeof RUM_PAGES)[number]`, `resolveRumPage(pathname: string): RumPage` — used by Task 2 (Zod schema), Task 3 (metrics), Task 5 (client component).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/analytics/rum-pages.test.ts
import { describe, expect, it } from "vitest";
import { resolveRumPage, RUM_PAGES } from "./rum-pages";

describe("resolveRumPage", () => {
  it("riconosce le route note", () => {
    expect(resolveRumPage("/panoramica")).toBe("panoramica");
    expect(resolveRumPage("/transazioni")).toBe("transazioni");
    expect(resolveRumPage("/login")).toBe("login");
  });

  it("normalizza una route nota con trailing slash o query", () => {
    expect(resolveRumPage("/conti/")).toBe("conti");
  });

  it("ricade su altro per route sconosciute o dinamiche", () => {
    expect(resolveRumPage("/qualcosa-di-strano")).toBe("altro");
    expect(resolveRumPage("/")).toBe("altro");
    expect(resolveRumPage("/api/rum")).toBe("altro");
  });

  it("RUM_PAGES contiene sempre altro come fallback", () => {
    expect(RUM_PAGES).toContain("altro");
  });
});
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `pnpm vitest run lib/analytics/rum-pages.test.ts`
Expected: FAIL — `Cannot find module './rum-pages'`

- [ ] **Step 3: Implement**

```typescript
// lib/analytics/rum-pages.ts

/**
 * Client routes trackable by RUM (Web Vitals), plus "altro" ("other") as a fallback. Static whitelist:
 * never the raw pathname in a Prometheus metric label (cardinality/injection, same
 * principle as assertStaticRouteName for API routes).
 */
export const RUM_PAGES = [
  "panoramica",
  "conti",
  "transazioni",
  "cash-flow",
  "investimenti",
  "categorie",
  "categorizza",
  "style-guide",
  "login",
  "onboarding",
  "altro",
] as const;

export type RumPage = (typeof RUM_PAGES)[number];

const KNOWN_SEGMENTS = new Set<string>(RUM_PAGES.filter((p) => p !== "altro"));

/** Maps a browser pathname to a known page, or "altro" if not recognised. */
export function resolveRumPage(pathname: string): RumPage {
  const segment = pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  return KNOWN_SEGMENTS.has(segment) ? (segment as RumPage) : "altro";
}
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `pnpm vitest run lib/analytics/rum-pages.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Export from the barrel**

Add to `lib/analytics/index.ts`:

```typescript
export { resolveRumPage, RUM_PAGES } from "./rum-pages";
export type { RumPage } from "./rum-pages";
```

- [ ] **Step 6: Commit**

```bash
git add lib/analytics/rum-pages.ts lib/analytics/rum-pages.test.ts lib/analytics/index.ts
git commit -m "feat: whitelist pagine RUM condivisa client/server"
```

---

## Task 2: Web Vitals histograms in metrics.ts

**Files:**
- Modify: `lib/observability/metrics.ts:1-270`
- Modify: `lib/observability/metrics.test.ts`
- Modify: `lib/observability/index.ts`

**Interfaces:**
- Consumes: `RumPage` from Task 1 (only as a type, for the `page` label).
- Produces: `recordWebVital(metric: "LCP" | "CLS" | "INP", page: string, value: number): void` — used by Task 4 (`/api/rum` route).

- [ ] **Step 1: Write the failing test**

Add at the bottom of `lib/observability/metrics.test.ts` (same file, same pattern as the existing `it`s — also import `recordWebVital` in the existing import at the top of the file):

```typescript
// in the existing import at the top of the file, add recordWebVital to the list imported from "./metrics"

it("registra i Web Vitals con conversione ms->s per LCP/INP e passthrough per CLS", async () => {
  recordWebVital("LCP", "panoramica", 1800);
  recordWebVital("INP", "panoramica", 150);
  recordWebVital("CLS", "panoramica", 0.05);
  const t = await text();
  expect(t).toContain('buddybudget_web_vitals_lcp_seconds_bucket{page="panoramica",le="1.8"} 1');
  expect(t).toContain('buddybudget_web_vitals_lcp_seconds_sum{page="panoramica"} 1.8');
  expect(t).toContain('buddybudget_web_vitals_inp_seconds_sum{page="panoramica"} 0.15');
  expect(t).toContain('buddybudget_web_vitals_cls_score_sum{page="panoramica"} 0.05');
});
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `pnpm vitest run lib/observability/metrics.test.ts`
Expected: FAIL — `recordWebVital is not a function` (or import error)

- [ ] **Step 3: Implement**

In `lib/observability/metrics.ts`, add to the types (near `AuthEvent`):

```typescript
export type WebVitalMetric = "LCP" | "CLS" | "INP";
```

Add the dedicated buckets (near `DURATION_BUCKETS_SECONDS`):

```typescript
/** Buckets (seconds) for LCP: good <=2.5s, poor >4s (Core Web Vitals thresholds). */
export const LCP_BUCKETS_SECONDS = [0.5, 1, 1.8, 2.5, 3, 4, 5, 8];
/** Buckets (seconds) for INP: good <=200ms, poor >500ms. */
export const INP_BUCKETS_SECONDS = [0.05, 0.1, 0.2, 0.3, 0.5, 1];
/** Buckets (dimensionless) for CLS: good <=0.1, poor >0.25. */
export const CLS_BUCKETS = [0.05, 0.1, 0.15, 0.25, 0.4, 0.6, 1];
```

Add to the fields of `MetricsState` (near `priceProvider`):

```typescript
  webVitalsLcp: Histogram<"page">;
  webVitalsInp: Histogram<"page">;
  webVitalsCls: Histogram<"page">;
```

Add in `createState()`, after the definition of `state.priceProvider`:

```typescript
  state.webVitalsLcp = new Histogram({
    name: `${METRIC_PREFIX}web_vitals_lcp_seconds`,
    help: "Largest Contentful Paint per pagina, riportato dal browser (Web Vitals reali).",
    labelNames: ["page"],
    buckets: LCP_BUCKETS_SECONDS,
    registers: r,
  });
  state.webVitalsInp = new Histogram({
    name: `${METRIC_PREFIX}web_vitals_inp_seconds`,
    help: "Interaction to Next Paint per pagina, riportato dal browser (Web Vitals reali).",
    labelNames: ["page"],
    buckets: INP_BUCKETS_SECONDS,
    registers: r,
  });
  state.webVitalsCls = new Histogram({
    name: `${METRIC_PREFIX}web_vitals_cls_score`,
    help: "Cumulative Layout Shift per pagina (punteggio adimensionale), riportato dal browser.",
    labelNames: ["page"],
    buckets: CLS_BUCKETS,
    registers: r,
  });
```

Add at the bottom of the file, after `recordPriceProviderRequest`:

```typescript
/** Records a Web Vital reported by the browser. LCP/INP arrive in milliseconds, CLS is already dimensionless. */
export function recordWebVital(metric: WebVitalMetric, page: string, value: number): void {
  const m = metrics();
  if (metric === "LCP") m.webVitalsLcp.observe({ page }, value / 1000);
  else if (metric === "INP") m.webVitalsInp.observe({ page }, value / 1000);
  else m.webVitalsCls.observe({ page }, value);
}
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `pnpm vitest run lib/observability/metrics.test.ts`
Expected: PASS (all the tests in the file, including the new one)

- [ ] **Step 5: Export from the barrel**

Add to `lib/observability/index.ts`, in the block that already exports from `"./metrics"`:

```typescript
  recordWebVital,
```

and in the `export type { ... } from "./metrics"` block:

```typescript
  WebVitalMetric,
```

- [ ] **Step 6: Commit**

```bash
git add lib/observability/metrics.ts lib/observability/metrics.test.ts lib/observability/index.ts
git commit -m "feat: istogrammi Prometheus per Web Vitals (LCP/INP/CLS)"
```

---

## Task 3: Public route POST /api/rum

**Files:**
- Create: `lib/validation/rum.ts`
- Create: `app/api/rum/route.ts`
- Create: `app/api/rum/route.test.ts`

**Interfaces:**
- Consumes: `RUM_PAGES`, `RumPage` (Task 1); `recordWebVital`, `WebVitalMetric` (Task 2); `withRoute` (existing, `lib/observability`).
- Produces: `rumEventSchema` (Zod) — used only by this route, but exported for possible reuse in tests. Endpoint `POST /api/rum` — consumed by Task 5 (client component).

- [ ] **Step 1: Write the Zod schema**

```typescript
// lib/validation/rum.ts
import { z } from "zod";
import { RUM_PAGES } from "@/lib/analytics";

/** Payload of a RUM (Web Vitals) beacon from the browser. No personal data. */
export const rumEventSchema = z.object({
  metric: z.enum(["LCP", "CLS", "INP"]),
  value: z.number().finite().nonnegative(),
  page: z.enum(RUM_PAGES),
});

export type RumEventInput = z.infer<typeof rumEventSchema>;
```

- [ ] **Step 2: Write the failing route test**

```typescript
// app/api/rum/route.test.ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { getMetricsRegistry, resetMetricsForTests } from "@/lib/observability";
import { POST } from "./route";

function post(body: unknown) {
  return new NextRequest("http://localhost/api/rum", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/rum", () => {
  beforeEach(() => resetMetricsForTests());

  it("accetta un payload valido e scrive l'istogramma", async () => {
    const response = await POST(post({ metric: "LCP", value: 1800, page: "panoramica" }));
    expect(response.status).toBe(204);
    const metrics = await getMetricsRegistry().metrics();
    expect(metrics).toContain('buddybudget_web_vitals_lcp_seconds_sum{page="panoramica"} 1.8');
  });

  it("rifiuta un metric fuori enum", async () => {
    const response = await POST(post({ metric: "FCP", value: 100, page: "panoramica" }));
    expect(response.status).toBe(400);
  });

  it("rifiuta un page fuori whitelist", async () => {
    const response = await POST(post({ metric: "LCP", value: 100, page: "../../etc/passwd" }));
    expect(response.status).toBe(400);
  });

  it("rifiuta un value negativo", async () => {
    const response = await POST(post({ metric: "CLS", value: -1, page: "panoramica" }));
    expect(response.status).toBe(400);
  });

  it("rifiuta un body non JSON senza lanciare", async () => {
    const request = new NextRequest("http://localhost/api/rum", { method: "POST", body: "non-json" });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run the test and check that it fails**

Run: `pnpm vitest run app/api/rum/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 4: Implement the route**

```typescript
// app/api/rum/route.ts
import { NextRequest } from "next/server";
import { recordWebVital, withRoute } from "@/lib/observability";
import { rumEventSchema } from "@/lib/validation/rum";

/**
 * Receives a Web Vitals beacon from the browser (LCP/CLS/INP) and writes it to Prometheus.
 * Public (it also applies to /login, before authentication), no DB writes, no personal data.
 */
async function handlePost(request: NextRequest) {
  const parsed = rumEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  recordWebVital(parsed.data.metric, parsed.data.page, parsed.data.value);
  return new Response(null, { status: 204 });
}

export const POST = withRoute("rum.report", handlePost, { quietOnSuccess: true });
```

- [ ] **Step 5: Run the test and check that it passes**

Run: `pnpm vitest run app/api/rum/route.test.ts`
Expected: PASS (5 test)

- [ ] **Step 6: Commit**

```bash
git add lib/validation/rum.ts app/api/rum/route.ts app/api/rum/route.test.ts
git commit -m "feat: route pubblica POST /api/rum per i Web Vitals"
```

---

## Task 4: Removal of @vercel/analytics + WebVitalsReporter client component

**Files:**
- Create: `components/analytics/web-vitals-reporter.tsx`
- Modify: `components/analytics/index.ts`
- Modify: `app/layout.tsx:1-81`
- Modify: `package.json`

**Interfaces:**
- Consumes: `resolveRumPage` (Task 1). No type dependency on the API routes (the beacon is fire-and-forget, no response is read).
- Produces: `WebVitalsReporter` component (named export), mounted in `app/layout.tsx` — no other task consumes it.

- [ ] **Step 1: Remove the dependency and add web-vitals**

Run: `pnpm remove @vercel/analytics && pnpm add web-vitals`
Expected: `package.json` no longer has `@vercel/analytics`, and has a new `web-vitals` entry in `dependencies`.

- [ ] **Step 2: Remove the usage in app/layout.tsx**

In `app/layout.tsx`, remove the line `import { Analytics } from "@vercel/analytics/next";` and the line `<Analytics />` (right after `</QueryProvider>`, before `<PwaInstallTracker />`).

- [ ] **Step 3: Write the client component**

```tsx
// components/analytics/web-vitals-reporter.tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { onCLS, onINP, onLCP, type Metric } from "web-vitals";
import { resolveRumPage } from "@/lib/analytics";

function sendBeacon(page: string, metric: Metric) {
  const payload = JSON.stringify({ metric: metric.name, value: metric.value, page });
  const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/rum", payload);
  if (!sent) {
    fetch("/api/rum", { method: "POST", body: payload, keepalive: true }).catch(() => {
      // Best-effort: a lost beacon must not break the UI.
    });
  }
}

/**
 * Collects the Core Web Vitals (LCP/CLS/INP) of the current page and sends them to /api/rum.
 * Renders nothing, no personal data in the payload.
 */
export function WebVitalsReporter() {
  const pathname = usePathname();

  useEffect(() => {
    const page = resolveRumPage(pathname);
    const report = (metric: Metric) => sendBeacon(page, metric);
    onLCP(report);
    onCLS(report);
    onINP(report);
  }, [pathname]);

  return null;
}
```

- [ ] **Step 4: Mount the component and verify manually**

In `app/layout.tsx`, add the import `import { PwaInstallTracker, WebVitalsReporter } from "@/components/analytics";` (replacing the existing import of `PwaInstallTracker` alone) and add `<WebVitalsReporter />` right after `<PwaInstallTracker />`.

Add to `components/analytics/index.ts`:

```typescript
export { WebVitalsReporter } from "./web-vitals-reporter";
```

Run: `pnpm dev`, open `http://localhost:3000/login` in the browser, open DevTools → Network, filter `rum` — after a few seconds a `POST /api/rum` request with status 204 must appear (LCP arrives almost immediately; CLS/INP may only arrive when changing page or interacting, it is normal if they do not show up in the first check).

- [ ] **Step 5: Run the suite and check that there are no regressions**

Run: `pnpm vitest run`
Expected: PASS (no existing test references `@vercel/analytics`)

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml app/layout.tsx components/analytics/web-vitals-reporter.tsx components/analytics/index.ts
git commit -m "feat: sostituisce @vercel/analytics con RUM custom (Web Vitals -> /api/rum)"
```

---

## Task 5: Grafana dashboard + alerts (buddy-budget-infra repo)

**Files (`<percorso-repo-infra>` repo):**
- Create: `argocd\manifests\grafana-dashboards\dashboards\performance.json`
- Create: `docs\runbooks\performance-lenta.md`
- Modify: `argocd\apps\grafana.yaml`

**Interfaces:**
- Consumes: the metrics `buddybudget_web_vitals_lcp_seconds`, `buddybudget_web_vitals_inp_seconds`, `buddybudget_web_vitals_cls_score` produced by Task 2 (exact names, `page` label) — this task does not touch app code, only infra manifests.
- Produces: Grafana dashboard `bb-performance`, 3 alert rules in the existing `buddybudget` group.

- [ ] **Step 1: Create the dashboard**

```json
// argocd/manifests/grafana-dashboards/dashboards/performance.json
{
  "uid": "bb-performance",
  "title": "BuddyBudget — Performance frontend",
  "tags": ["buddybudget"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "5m",
  "time": { "from": "now-24h", "to": "now" },
  "panels": [
    {
      "id": 1,
      "type": "timeseries",
      "title": "LCP p75 per pagina (Largest Contentful Paint)",
      "description": "Quanto tempo impiega il contenuto principale a comparire, visto dal browser dell'utente. Buono sotto 2.5s, scarso sopra 4s. Se sale, la pagina/i dati sono diventati più pesanti o il pod è sotto carico.",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "victoriametrics" },
      "targets": [
        {
          "expr": "histogram_quantile(0.75, sum by (le, page) (rate(buddybudget_web_vitals_lcp_seconds_bucket[$__rate_interval])))",
          "legendFormat": "{{page}}"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "s" }, "overrides": [] }
    },
    {
      "id": 2,
      "type": "timeseries",
      "title": "INP p75 per pagina (Interaction to Next Paint)",
      "description": "Quanto tempo passa tra un click/tap dell'utente e la reazione visibile della UI. Buono sotto 200ms, scarso sopra 500ms.",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "victoriametrics" },
      "targets": [
        {
          "expr": "histogram_quantile(0.75, sum by (le, page) (rate(buddybudget_web_vitals_inp_seconds_bucket[$__rate_interval])))",
          "legendFormat": "{{page}}"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "s" }, "overrides": [] }
    },
    {
      "id": 3,
      "type": "timeseries",
      "title": "CLS p75 per pagina (Cumulative Layout Shift)",
      "description": "Quanto la pagina 'salta' mentre si carica (elementi che si spostano sotto il dito/mouse). Buono sotto 0.1, scarso sopra 0.25. Punteggio adimensionale, non un tempo.",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "victoriametrics" },
      "targets": [
        {
          "expr": "histogram_quantile(0.75, sum by (le, page) (rate(buddybudget_web_vitals_cls_score_bucket[$__rate_interval])))",
          "legendFormat": "{{page}}"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "none" }, "overrides": [] }
    }
  ]
}
```

- [ ] **Step 2: Register the dashboard in the kustomization**

Open `argocd/manifests/grafana-dashboards/kustomization.yaml`, add `performance.json` to the list of files already present (same format as the already listed `app.json`/`sync.json`/`cluster.json`/`logs.json`).

- [ ] **Step 3: Add the 3 alert rules**

In `argocd/apps/grafana.yaml`, inside `alerting.rules.yaml.groups[0].rules` (the `buddybudget` group), add at the end of the existing list (after the `bb-pod-crashloop` rule, same YAML indentation as the existing rules):

```yaml
              - uid: bb-lcp-lento
                title: Caricamento pagine lento (LCP)
                condition: C
                data:
                - refId: A
                  datasourceUid: victoriametrics
                  relativeTimeRange:
                    from: 3600
                    to: 0
                  model:
                    expr: histogram_quantile(0.75, sum by (le) (rate(buddybudget_web_vitals_lcp_seconds_bucket[30m])))
                    instant: true
                    intervalMs: 1000
                    maxDataPoints: 43200
                    refId: A
                - refId: C
                  datasourceUid: __expr__
                  model:
                    type: threshold
                    expression: A
                    conditions:
                    - evaluator:
                        type: gt
                        params:
                        - 2.5
                    refId: C
                noDataState: OK
                execErrState: Error
                for: 30m
                labels:
                  severity: warning
                annotations:
                  summary: Il 75% delle pagine impiega più di 2.5s a mostrare il contenuto principale (LCP).
                  description: 'Soglia Google per "buono". Gli utenti percepiscono l''app come lenta al caricamento. Valore attuale: {{ printf "%.2f" $values.A.Value }}s.'
                  runbook_url: https://github.com/YonderUrik/buddy-budget-infra/blob/main/docs/runbooks/performance-lenta.md
                  dashboard: https://grafana.<tailnet>.ts.net/d/bb-performance
              - uid: bb-inp-lento
                title: App poco reattiva (INP)
                condition: C
                data:
                - refId: A
                  datasourceUid: victoriametrics
                  relativeTimeRange:
                    from: 3600
                    to: 0
                  model:
                    expr: histogram_quantile(0.75, sum by (le) (rate(buddybudget_web_vitals_inp_seconds_bucket[30m])))
                    instant: true
                    intervalMs: 1000
                    maxDataPoints: 43200
                    refId: A
                - refId: C
                  datasourceUid: __expr__
                  model:
                    type: threshold
                    expression: A
                    conditions:
                    - evaluator:
                        type: gt
                        params:
                        - 0.2
                    refId: C
                noDataState: OK
                execErrState: Error
                for: 30m
                labels:
                  severity: warning
                annotations:
                  summary: Il 75% delle interazioni impiega più di 200ms a reagire (INP).
                  description: 'Soglia Google per "buono". L''app sembra "impastata" ai click/tap. Valore attuale: {{ printf "%.0f" $values.A.Value }}ms considerando il valore in secondi *1000.'
                  runbook_url: https://github.com/YonderUrik/buddy-budget-infra/blob/main/docs/runbooks/performance-lenta.md
                  dashboard: https://grafana.<tailnet>.ts.net/d/bb-performance
              - uid: bb-cls-instabile
                title: Layout instabile (CLS)
                condition: C
                data:
                - refId: A
                  datasourceUid: victoriametrics
                  relativeTimeRange:
                    from: 3600
                    to: 0
                  model:
                    expr: histogram_quantile(0.75, sum by (le) (rate(buddybudget_web_vitals_cls_score_bucket[30m])))
                    instant: true
                    intervalMs: 1000
                    maxDataPoints: 43200
                    refId: A
                - refId: C
                  datasourceUid: __expr__
                  model:
                    type: threshold
                    expression: A
                    conditions:
                    - evaluator:
                        type: gt
                        params:
                        - 0.1
                    refId: C
                noDataState: OK
                execErrState: Error
                for: 30m
                labels:
                  severity: warning
                annotations:
                  summary: Il 75% delle pagine sposta elementi visibili mentre carica (CLS).
                  description: 'Soglia Google per "buono". Probabile immagine/font senza dimensioni riservate, o contenuto iniettato sopra quanto già visibile. Valore attuale: {{ printf "%.2f" $values.A.Value }}.'
                  runbook_url: https://github.com/YonderUrik/buddy-budget-infra/blob/main/docs/runbooks/performance-lenta.md
                  dashboard: https://grafana.<tailnet>.ts.net/d/bb-performance
```

- [ ] **Step 4: Write the runbook**

```markdown
<!-- docs/runbooks/performance-lenta.md -->
# App lenta o instabile (Web Vitals: LCP/INP/CLS)

## Cosa significa

Uno dei tre alert scattati:

- **LCP alto**: il contenuto principale della pagina impiega troppo a comparire.
- **INP alto**: l'app reagisce con ritardo a click/tap.
- **CLS alto**: elementi visibili si spostano mentre la pagina carica.

Il valore è il **p75** (75° percentile) sull'ultima mezz'ora: 3 utenti su 4 hanno
un'esperienza uguale o migliore di quella riportata.

## Cosa controllare

1. Dashboard `BuddyBudget — Performance frontend` (link nell'alert): quale pagina
   (`page`) è coinvolta — un problema su una sola pagina indica un componente
   pesante lì, non un problema generale.
2. Dashboard `BuddyBudget — App`: la latenza API (`bb-latenza-alta`) è alta nello
   stesso periodo? Se sì, il problema è probabilmente lato server (query lenta,
   pod sotto carico), non frontend.
3. `kubectl top pods -n app`: il pod è sotto pressione CPU/memoria?
4. Se solo CLS: cercare nel codice recente componenti che inseriscono contenuto
   sopra quanto già visibile (banner, immagini senza `width`/`height`) sulla
   pagina indicata.

## Falsi positivi noti

- Poche visite in mezz'ora rendono il p75 rumoroso (una singola visita da rete
  lenta può far scattare l'alert). Verificare il volume di richieste nella
  dashboard prima di allarmarsi per una singola pagina isolata.
```

- [ ] **Step 5: Check the YAML rendering**

Run (from `<percorso-repo-infra>`): `helm template grafana grafana/grafana -f <(echo "") --dry-run 2>/dev/null; python -c "import yaml,sys; yaml.safe_load(open('argocd/apps/grafana.yaml'))" || (Get-Content argocd/apps/grafana.yaml | ConvertFrom-Yaml)`

In practice: just check that the file is valid YAML with a parser available locally (e.g. `python -c "import yaml; yaml.safe_load(open('argocd/apps/grafana.yaml', encoding='utf-8'))"` if Python+PyYAML are available, otherwise open the file and check the indentation by eye against the existing rules — it must be identical, 14 spaces for `- uid:`).

- [ ] **Step 6: Commit (in the infra repo)**

```bash
cd <percorso-repo-infra>
git add argocd/manifests/grafana-dashboards/dashboards/performance.json argocd/manifests/grafana-dashboards/kustomization.yaml argocd/apps/grafana.yaml docs/runbooks/performance-lenta.md
git commit -m "feat: dashboard e alert Grafana per i Web Vitals (LCP/INP/CLS)"
```

Note: this commit must then be pushed and merged into `main` of the infra repo for ArgoCD to apply it — this plan does not do that (same scheme as the other infra PRs: opening a PR or merging directly according to the practice already in use in this repo).

---

## Task 6: Umami funnel/retention documentation (buddy-budget-infra repo)

**Files (`<percorso-repo-infra>` repo):**
- Modify: `docs\osservabilita.md`

**Interfaces:**
- Consumes: nothing (documentation only, no code).
- Produces: nothing for other tasks — final step of the plan.

- [ ] **Step 1: Read the existing structure of the document**

Open `docs/osservabilita.md` and find the last section (to understand the style: headings, tone, any links to dashboards/Grafana) before adding the new section at the bottom.

- [ ] **Step 2: Add the section**

Add at the bottom of `docs/osservabilita.md`:

```markdown
## Funnel e retention utenti (Umami)

Nessuna configurazione da codice: si fa tutto nella UI di Umami
(`https://umami.<tailnet>.ts.net`, solo Tailscale).

### Funnel onboarding

Umami → **Report** → **Funnel** → nuovo report con questi passi, nell'ordine:

1. `onboarding_completed`
2. `bank_connect_started`
3. `bank_connect_completed`

Questi eventi sono già inviati da `lib/analytics/track.ts` nell'app (nessuna
modifica di codice necessaria). Il report mostra a che passo si fermano i
nuovi utenti — utile per capire se il collegamento della banca è un punto di
abbandono.

### Retention

Umami → **Report** → **Retention**: report nativo su pageview, nessuna
configurazione richiesta. Mostra quanti utenti tornano a distanza di N giorni
dalla prima visita.
```

- [ ] **Step 3: Commit (in the infra repo)**

```bash
cd <percorso-repo-infra>
git add docs/osservabilita.md
git commit -m "docs: come configurare funnel onboarding e retention in Umami"
```

Note: like Task 5, it must be pushed to `main` to take effect (no ArgoCD involved here, it is only docs — no sync required, but it still goes on `main` to be findable).
