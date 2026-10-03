# Performance frontend (RUM) + retention/funnel Umami Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire `@vercel/analytics` (dead code post-migrazione VPS) con Web Vitals reali (LCP/CLS/INP) raccolti lato client e riportati come istogrammi Prometheus, visibili in una nuova dashboard Grafana con alert; documentare la configurazione (UI, nessun codice) di funnel onboarding e retention in Umami.

**Architecture:** Componente client `WebVitalsReporter` (libreria `web-vitals`) invia un beacon per metrica a una nuova route pubblica `POST /api/rum`, che valida il payload e scrive su 3 nuovi istogrammi `lib/observability/metrics.ts` (stesso registry Prometheus già esposto da `/api/metrics`). Repo infra: nuova dashboard Grafana as-code + 3 regole di alert nel gruppo esistente + runbook. La whitelist delle pagine tracciabili (`RUM_PAGES`) è condivisa client/server per evitare cardinalità/injection nelle label.

**Tech Stack:** Next.js App Router, `web-vitals` (nuovo), prom-client (esistente), Zod, Vitest, Grafana as-code (repo `buddy-budget-infra`).

**Spec:** `docs/superpowers/specs/2026-09-28-performance-frontend-retention-design.md`

## Global Constraints

- Prefisso metriche: `buddybudget_` (`METRIC_PREFIX` in `lib/observability/metrics.ts`).
- Mai un valore arbitrario del chiamante in una label di metrica: `page` è sempre uno dei valori di `RUM_PAGES`, verificato sia lato client (mapping) sia lato server (schema Zod), mai il pathname grezzo.
- Nomi di route statici per `withRoute` (mai un path con id): questa route si chiama `"rum.report"`.
- Solo Core Web Vitals (LCP, CLS, INP) — niente FCP/TTFB in questo giro.
- Nessuna scrittura DB, nessun dato personale nel payload RUM.
- Soglie di alert: valori standard Google (LCP p75 > 2.5s, INP p75 > 200ms, CLS p75 > 0.1), severità `warning` → `#bb-avvisi`, stesso pattern del gruppo `buddybudget` in `argocd/apps/grafana.yaml`.
- Repo infra: `<percorso-repo-infra>` (repo git separato da questo).

## Review Focus

- **`value` negativo o non numerico nel body `/api/rum`** — un client compromesso o un bug futuro nella libreria non deve poter scrivere un istogramma con un valore assurdo; lo schema Zod deve rifiutarlo con 400, non silenziosamente accettarlo o crashare la route.
- **`page` fuori whitelist** (route non ancora mappata, o valore manomesso) — deve tornare 400, mai finire come label libera nell'istogramma (cardinalità/injection, stesso principio di `assertStaticRouteName`).
- **`metric` fuori dall'enum `LCP`/`CLS`/`INP`** — deve tornare 400, non silenziosamente ignorato né mappato a caso su uno dei tre istogrammi.
- **Body non JSON o mancante** (`sendBeacon` bloccato da estensioni, rete instabile) — la route non deve lanciare un'eccezione non gestita; stesso pattern `.json().catch(() => null)` già usato altrove.
- **`sendBeacon` non disponibile o rifiutato** (browser vecchio, blocklist) — il componente client deve avere un fallback (`fetch` con `keepalive: true`) invece di perdere silenziosamente ogni dato.

---

## Task 1: Whitelist pagine RUM condivisa

**Files:**
- Create: `lib/analytics/rum-pages.ts`
- Test: `lib/analytics/rum-pages.test.ts`
- Modify: `lib/analytics/index.ts`

**Interfaces:**
- Consumes: nulla (funzione pura, nessuna dipendenza da altri task).
- Produces: `RUM_PAGES: readonly string[]`, `type RumPage = (typeof RUM_PAGES)[number]`, `resolveRumPage(pathname: string): RumPage` — usati da Task 2 (schema Zod), Task 3 (metriche), Task 5 (componente client).

- [ ] **Step 1: Scrivi il test che fallisce**

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm vitest run lib/analytics/rum-pages.test.ts`
Expected: FAIL — `Cannot find module './rum-pages'`

- [ ] **Step 3: Implementa**

```typescript
// lib/analytics/rum-pages.ts

/**
 * Route client tracciabili dal RUM (Web Vitals), più "altro" come fallback. Whitelist statica:
 * mai il pathname grezzo in una label di metrica Prometheus (cardinalità/injection, stesso
 * principio di assertStaticRouteName per le route API).
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

/** Mappa un pathname del browser a una pagina nota, o "altro" se non riconosciuta. */
export function resolveRumPage(pathname: string): RumPage {
  const segment = pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  return KNOWN_SEGMENTS.has(segment) ? (segment as RumPage) : "altro";
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm vitest run lib/analytics/rum-pages.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Esporta dal barrel**

Aggiungi in `lib/analytics/index.ts`:

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

## Task 2: Istogrammi Web Vitals in metrics.ts

**Files:**
- Modify: `lib/observability/metrics.ts:1-270`
- Modify: `lib/observability/metrics.test.ts`
- Modify: `lib/observability/index.ts`

**Interfaces:**
- Consumes: `RumPage` da Task 1 (solo come tipo, per l'etichetta `page`).
- Produces: `recordWebVital(metric: "LCP" | "CLS" | "INP", page: string, value: number): void` — usata da Task 4 (route `/api/rum`).

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `lib/observability/metrics.test.ts` (stesso file, stesso pattern degli `it` esistenti — importa anche `recordWebVital` nell'import esistente in cima al file):

```typescript
// nell'import esistente in cima al file, aggiungi recordWebVital all'elenco importato da "./metrics"

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

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `pnpm vitest run lib/observability/metrics.test.ts`
Expected: FAIL — `recordWebVital is not a function` (o import error)

- [ ] **Step 3: Implementa**

In `lib/observability/metrics.ts`, aggiungi ai tipi (vicino a `AuthEvent`):

```typescript
export type WebVitalMetric = "LCP" | "CLS" | "INP";
```

Aggiungi ai bucket dedicati (vicino a `DURATION_BUCKETS_SECONDS`):

```typescript
/** Bucket (secondi) per LCP: buono <=2.5s, scarso >4s (soglie Core Web Vitals). */
export const LCP_BUCKETS_SECONDS = [0.5, 1, 1.8, 2.5, 3, 4, 5, 8];
/** Bucket (secondi) per INP: buono <=200ms, scarso >500ms. */
export const INP_BUCKETS_SECONDS = [0.05, 0.1, 0.2, 0.3, 0.5, 1];
/** Bucket (adimensionali) per CLS: buono <=0.1, scarso >0.25. */
export const CLS_BUCKETS = [0.05, 0.1, 0.15, 0.25, 0.4, 0.6, 1];
```

Aggiungi ai campi di `MetricsState` (vicino a `priceProvider`):

```typescript
  webVitalsLcp: Histogram<"page">;
  webVitalsInp: Histogram<"page">;
  webVitalsCls: Histogram<"page">;
```

Aggiungi in `createState()`, dopo la definizione di `state.priceProvider`:

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

Aggiungi in fondo al file, dopo `recordPriceProviderRequest`:

```typescript
/** Registra un Web Vital riportato dal browser. LCP/INP arrivano in millisecondi, CLS è già adimensionale. */
export function recordWebVital(metric: WebVitalMetric, page: string, value: number): void {
  const m = metrics();
  if (metric === "LCP") m.webVitalsLcp.observe({ page }, value / 1000);
  else if (metric === "INP") m.webVitalsInp.observe({ page }, value / 1000);
  else m.webVitalsCls.observe({ page }, value);
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `pnpm vitest run lib/observability/metrics.test.ts`
Expected: PASS (tutti i test del file, incluso quello nuovo)

- [ ] **Step 5: Esporta dal barrel**

Aggiungi in `lib/observability/index.ts`, nel blocco che già esporta da `"./metrics"`:

```typescript
  recordWebVital,
```

e nel blocco `export type { ... } from "./metrics"`:

```typescript
  WebVitalMetric,
```

- [ ] **Step 6: Commit**

```bash
git add lib/observability/metrics.ts lib/observability/metrics.test.ts lib/observability/index.ts
git commit -m "feat: istogrammi Prometheus per Web Vitals (LCP/INP/CLS)"
```

---

## Task 3: Route pubblica POST /api/rum

**Files:**
- Create: `lib/validation/rum.ts`
- Create: `app/api/rum/route.ts`
- Create: `app/api/rum/route.test.ts`

**Interfaces:**
- Consumes: `RUM_PAGES`, `RumPage` (Task 1); `recordWebVital`, `WebVitalMetric` (Task 2); `withRoute` (esistente, `lib/observability`).
- Produces: `rumEventSchema` (Zod) — usato solo da questa route, ma esportato per eventuale riuso nei test. Endpoint `POST /api/rum` — consumato da Task 5 (componente client).

- [ ] **Step 1: Scrivi lo schema Zod**

```typescript
// lib/validation/rum.ts
import { z } from "zod";
import { RUM_PAGES } from "@/lib/analytics";

/** Payload di un beacon RUM (Web Vitals) dal browser. Nessun dato personale. */
export const rumEventSchema = z.object({
  metric: z.enum(["LCP", "CLS", "INP"]),
  value: z.number().finite().nonnegative(),
  page: z.enum(RUM_PAGES),
});

export type RumEventInput = z.infer<typeof rumEventSchema>;
```

- [ ] **Step 2: Scrivi il test della route che fallisce**

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

- [ ] **Step 3: Esegui il test e verifica che fallisca**

Run: `pnpm vitest run app/api/rum/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 4: Implementa la route**

```typescript
// app/api/rum/route.ts
import { NextRequest } from "next/server";
import { recordWebVital, withRoute } from "@/lib/observability";
import { rumEventSchema } from "@/lib/validation/rum";

/**
 * Riceve un beacon Web Vitals dal browser (LCP/CLS/INP) e lo scrive su Prometheus.
 * Pubblica (vale anche per /login, pre-autenticazione), nessuna scrittura DB, nessun dato personale.
 */
async function handlePost(request: NextRequest) {
  const parsed = rumEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  recordWebVital(parsed.data.metric, parsed.data.page, parsed.data.value);
  return new Response(null, { status: 204 });
}

export const POST = withRoute("rum.report", handlePost, { quietOnSuccess: true });
```

- [ ] **Step 5: Esegui il test e verifica che passi**

Run: `pnpm vitest run app/api/rum/route.test.ts`
Expected: PASS (5 test)

- [ ] **Step 6: Commit**

```bash
git add lib/validation/rum.ts app/api/rum/route.ts app/api/rum/route.test.ts
git commit -m "feat: route pubblica POST /api/rum per i Web Vitals"
```

---

## Task 4: Rimozione @vercel/analytics + componente client WebVitalsReporter

**Files:**
- Create: `components/analytics/web-vitals-reporter.tsx`
- Modify: `components/analytics/index.ts`
- Modify: `app/layout.tsx:1-81`
- Modify: `package.json`

**Interfaces:**
- Consumes: `resolveRumPage` (Task 1). Nessuna dipendenza dalle route API lato tipo (il beacon è fire-and-forget, nessuna risposta letta).
- Produces: componente `WebVitalsReporter` (default export nominato), montato in `app/layout.tsx` — nessun altro task lo consuma.

- [ ] **Step 1: Rimuovi la dipendenza e aggiungi web-vitals**

Run: `pnpm remove @vercel/analytics && pnpm add web-vitals`
Expected: `package.json` non ha più `@vercel/analytics`, ha una nuova voce `web-vitals` in `dependencies`.

- [ ] **Step 2: Rimuovi l'uso in app/layout.tsx**

In `app/layout.tsx`, rimuovi la riga `import { Analytics } from "@vercel/analytics/next";` e la riga `<Analytics />` (subito dopo `</QueryProvider>`, prima di `<PwaInstallTracker />`).

- [ ] **Step 3: Scrivi il componente client**

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
      // Best-effort: un beacon perso non deve rompere la UI.
    });
  }
}

/**
 * Raccoglie i Core Web Vitals (LCP/CLS/INP) della pagina corrente e li invia a /api/rum.
 * Non renderizza nulla, nessun dato personale nel payload.
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

- [ ] **Step 4: Monta il componente e verifica manualmente**

In `app/layout.tsx`, aggiungi l'import `import { PwaInstallTracker, WebVitalsReporter } from "@/components/analytics";` (sostituendo l'import esistente di solo `PwaInstallTracker`) e aggiungi `<WebVitalsReporter />` subito dopo `<PwaInstallTracker />`.

Aggiungi in `components/analytics/index.ts`:

```typescript
export { WebVitalsReporter } from "./web-vitals-reporter";
```

Run: `pnpm dev`, apri `http://localhost:3000/login` nel browser, apri i DevTools → Network, filtra `rum` — dopo qualche secondo deve comparire una richiesta `POST /api/rum` con status 204 (LCP arriva quasi subito; CLS/INP possono arrivare solo cambiando pagina o interagendo, è normale se non compaiono nella prima verifica).

- [ ] **Step 5: Esegui la suite e verifica che non ci siano regressioni**

Run: `pnpm vitest run`
Expected: PASS (nessun test esistente referenzia `@vercel/analytics`)

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml app/layout.tsx components/analytics/web-vitals-reporter.tsx components/analytics/index.ts
git commit -m "feat: sostituisce @vercel/analytics con RUM custom (Web Vitals -> /api/rum)"
```

---

## Task 5: Dashboard Grafana + alert (repo buddy-budget-infra)

**Files (repo `<percorso-repo-infra>`):**
- Create: `argocd\manifests\grafana-dashboards\dashboards\performance.json`
- Create: `docs\runbooks\performance-lenta.md`
- Modify: `argocd\apps\grafana.yaml`

**Interfaces:**
- Consumes: le metriche `buddybudget_web_vitals_lcp_seconds`, `buddybudget_web_vitals_inp_seconds`, `buddybudget_web_vitals_cls_score` prodotte dal Task 2 (nomi esatti, label `page`) — questo task non tocca codice app, solo manifest infra.
- Produces: dashboard Grafana `bb-performance`, 3 regole di alert nel gruppo `buddybudget` esistente.

- [ ] **Step 1: Crea la dashboard**

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

- [ ] **Step 2: Registra la dashboard nella kustomization**

Apri `argocd/manifests/grafana-dashboards/kustomization.yaml`, aggiungi `performance.json` all'elenco dei file già presenti (stesso formato di `app.json`/`sync.json`/`cluster.json`/`logs.json` già elencati).

- [ ] **Step 3: Aggiungi le 3 regole di alert**

In `argocd/apps/grafana.yaml`, dentro `alerting.rules.yaml.groups[0].rules` (gruppo `buddybudget`), aggiungi in fondo all'elenco esistente (dopo la regola `bb-pod-crashloop`, stessa indentazione YAML delle regole esistenti):

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

- [ ] **Step 4: Scrivi il runbook**

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

- [ ] **Step 5: Verifica il rendering YAML**

Run (da `<percorso-repo-infra>`): `helm template grafana grafana/grafana -f <(echo "") --dry-run 2>/dev/null; python -c "import yaml,sys; yaml.safe_load(open('argocd/apps/grafana.yaml'))" || (Get-Content argocd/apps/grafana.yaml | ConvertFrom-Yaml)`

In pratica: verifica solo che il file sia YAML valido con un parser disponibile in locale (es. `python -c "import yaml; yaml.safe_load(open('argocd/apps/grafana.yaml', encoding='utf-8'))"` se Python+PyYAML sono disponibili, altrimenti apri il file e controlla a occhio l'indentazione contro le regole esistenti — deve essere identica, 14 spazi per `- uid:`).

- [ ] **Step 6: Commit (nel repo infra)**

```bash
cd <percorso-repo-infra>
git add argocd/manifests/grafana-dashboards/dashboards/performance.json argocd/manifests/grafana-dashboards/kustomization.yaml argocd/apps/grafana.yaml docs/runbooks/performance-lenta.md
git commit -m "feat: dashboard e alert Grafana per i Web Vitals (LCP/INP/CLS)"
```

Nota: questo commit va poi pushato e mergiato su `main` del repo infra perché ArgoCD lo applichi — non lo fa questo piano (stesso schema delle altre PR infra: apertura PR o merge diretto secondo la prassi già in uso in questo repo).

---

## Task 6: Documentazione funnel/retention Umami (repo buddy-budget-infra)

**Files (repo `<percorso-repo-infra>`):**
- Modify: `docs\osservabilita.md`

**Interfaces:**
- Consumes: nulla (solo documentazione, nessun codice).
- Produces: nulla per altri task — passo terminale del piano.

- [ ] **Step 1: Leggi la struttura esistente del documento**

Apri `docs/osservabilita.md` e individua l'ultima sezione (per capire lo stile: titoli, tono, eventuali link a dashboard/Grafana) prima di aggiungere la nuova sezione in fondo.

- [ ] **Step 2: Aggiungi la sezione**

Aggiungi in fondo a `docs/osservabilita.md`:

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

- [ ] **Step 3: Commit (nel repo infra)**

```bash
cd <percorso-repo-infra>
git add docs/osservabilita.md
git commit -m "docs: come configurare funnel onboarding e retention in Umami"
```

Nota: come il Task 5, va pushato su `main` per essere effettivo (qui non c'è ArgoCD di mezzo, è solo doc — nessun sync richiesto, ma va comunque su `main` per essere trovabile).
