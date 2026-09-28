# Performance frontend (RUM) + retention/funnel Umami

Data: 2026-09-28

## Obiettivo

L'utente ha notato due lacune nell'osservabilità dopo la migrazione VPS: (1) Umami mostra solo il dominio `app.buddybudget.io` come sorgente di traffico, non anche il dominio di produzione reale; (2) nessuna metrica di performance percepita dall'utente (Web Vitals), nessun funnel/retention configurato. Questo spec copre la seconda parte (la prima è già risolta: verificato dal vivo che `www.buddybudget.io/stats/script.js` e `/stats/api/send` rispondono 200, l'IngressRoute copre già tutti i domini dal commit `0ee8559`, Fase 7 — l'assenza in Umami è solo poco traffico reale accumulato da ieri o il campo "Domain" cosmetico nelle impostazioni del sito, non un problema di codice/infra).

Replay e heatmap sono esplicitamente rimandati (richiederebbero un tool nuovo nel cluster, es. PostHog self-hosted — più superficie con dati bancari in gioco, da valutare a parte).

## Stato di partenza

- `<Analytics />` di `@vercel/analytics` in [app/layout.tsx](../../app/layout.tsx) manda dati alla rete Vercel: da Fase 7 (2026-09-27) l'app gira su k3s, non più Vercel — probabilmente non fa più nulla di utile da allora. Nessuna verifica di funzionamento residuo tentata (impossibile senza accesso alla dashboard Vercel Analytics, che l'utente ha comunque smesso di pagare).
- Osservabilità applicativa esistente (Fase A/B, `docs/superpowers/specs/2026-09-27-osservabilita-app-fase-a-design.md`): `lib/observability/metrics.ts` (prom-client, prefisso `buddybudget_`), `withRoute` per ogni route, dashboard/alert Grafana as-code nel repo `buddy-budget-infra` (`argocd/apps/grafana.yaml`), runbook per alert in `docs/runbooks/`.
- Umami self-hosted (Fase 6) traccia già eventi di prodotto via `lib/analytics/track.ts` (`ProductEvents`), incluso l'intero funnel di onboarding: `onboarding_completed`, `bank_connect_started`, `bank_connect_completed`.

## Decisioni

1. **Rimuovere `@vercel/analytics`** (pacchetto + `<Analytics />` + import in `app/layout.tsx`): dead code post-migrazione, nessun sostituto 1:1 necessario perché il RUM lo sostituisce.
2. **RUM custom su Prometheus/Grafana**, non su Umami: gli eventi Umami sono conteggi/categorie, non fanno bene percentili su distribuzioni di durata (p75 è lo standard Web Vitals). Nuovo istogramma per metrica, stesso stack di alert/dashboard già in uso.
3. **Solo Core Web Vitals** (LCP, CLS, INP) — non FCP/TTFB: sono i tre che Google usa per il giudizio "buono/da migliorare/scarso" di una pagina, sufficienti a capire se l'app è percepita lenta.
4. **Retention/funnel**: nessun codice. Il funnel onboarding usa eventi già tracciati; il report Retention di Umami è nativo su pageview. Solo configurazione nella UI di Umami, documentata come runbook operativo (non un task di piano — l'utente la esegue quando vuole, senza bloccare il resto).
5. **Alert Grafana da subito** (non solo dashboard): soglie standard Google (p75 LCP > 2.5s, INP > 200ms, CLS > 0.1) sostenute per una finestra, severità `warning` su `#bb-avvisi` — stesso pattern di `bb-latenza-alta`.

## Architettura

### Client: raccolta e invio

Nuovo componente `components/analytics/web-vitals-reporter.tsx` (stesso pattern di `PwaInstallTracker`, client component "use null", montato in `app/layout.tsx` al posto di `<Analytics />`):

- Libreria `web-vitals` (nuova dipendenza, ~1KB gzip), `onLCP`/`onCLS`/`onINP` con le opzioni di default (valore finale per pageview, non ogni cambiamento intermedio).
- Ogni callback invia `navigator.sendBeacon('/api/rum', JSON.stringify({ metric, value, page, rating }))`, con fallback `fetch(..., { keepalive: true })` se `sendBeacon` non è disponibile o rifiuta il payload.
- `page` non è il `pathname` grezzo: `resolveRumPage(pathname)` lo mappa a una whitelist statica delle route conosciute (`/panoramica`, `/conti`, `/transazioni`, `/cash-flow`, `/investimenti`, `/categorie`, `/categorizza`, `/style-guide`, `/login`, `/onboarding`), fallback `"altro"`. Stessa cautela di `withRoute`: mai un valore arbitrario del chiamante in una label di metrica (cardinalità e injection).
- Nessun campionamento: il traffico reale di questa app è basso (utente singolo/pochi), non serve ridurre il volume di eventi.

### Server: raccolta

Nuova route `app/api/rum/route.ts`:

- `POST`, pubblica (nessun controllo di sessione — servono anche le metriche di `/login`, pagina pre-autenticazione), `withRoute("rum.report", handler, { quietOnSuccess: true })`.
- Body validato con Zod: `metric` enum `"LCP" | "CLS" | "INP"`, `value` number positivo, `page` string (uno dei valori della whitelist lato server, stessa lista di `resolveRumPage` — un valore fuori whitelist è un 400, non finisce mai in una label).
- Nessuna scrittura DB, nessun dato personale: chiama `recordWebVital(metric, page, value)` e risponde `204`.

### Metriche (`lib/observability/metrics.ts`)

Tre nuovi istogrammi, label `page`, seguono il pattern esistente (`MetricsState`, `createState`, bucket dedicati come già fa `DURATION_BUCKETS_SECONDS` per l'HTTP):

- `webVitalsLcpSeconds` — bucket `[0.5, 1, 1.8, 2.5, 3, 4, 5, 8]` (soglie Google: buono ≤2.5s, scarso >4s).
- `webVitalsInpSeconds` — bucket `[0.05, 0.1, 0.2, 0.3, 0.5, 1]` (buono ≤200ms, scarso >500ms).
- `webVitalsClsScore` — bucket `[0.05, 0.1, 0.15, 0.25, 0.4, 0.6, 1]` (buono ≤0.1, scarso >0.25; adimensionale, non secondi).

Funzione `recordWebVital(metric: "LCP" | "CLS" | "INP", page: string, value: number)`: LCP/INP arrivano da `web-vitals` in millisecondi → `/1000` prima di `.observe()`; CLS è già adimensionale, nessuna conversione.

### Grafana (repo `buddy-budget-infra`)

- Nuova dashboard `argocd/manifests/grafana-dashboards/dashboards/performance.json` (stesso pattern di `app.json`/`sync.json`: una ConfigMap per topic), uid `bb-performance`: p75 LCP/INP per pagina (`histogram_quantile(0.75, sum by (le, page) (rate(buddybudget_web_vitals_..._bucket[$__rate_interval])))`), distribuzione CLS, ogni pannello con descrizione in italiano (valore normale + cosa fare), stesso stile delle dashboard esistenti.
- 3 nuove regole in `argocd/apps/grafana.yaml` (`alerting.rules.yaml`, gruppo `buddybudget` esistente): `bb-lcp-lento`, `bb-inp-lento`, `bb-cls-instabile`. Soglie Google sopra, finestra `for: 30m` (coerente con la bassa cardinalità di traffico, evita falsi positivi da una singola visita lenta), `severity: warning`, `noDataState: OK` (nessuna visita in 30 minuti non è un problema), runbook dedicato `docs/runbooks/performance-lenta.md` (repo infra), dashboard link `bb-performance`.

### Retention/funnel Umami (nessun codice)

Documentato come runbook operativo `docs/osservabilita.md` (repo infra), sezione nuova "Funnel e retention utenti":

- **Funnel onboarding**: Umami → Report → Funnel → passi `onboarding_completed` → `bank_connect_started` → `bank_connect_completed` (eventi già inviati da `lib/analytics/track.ts`, nessuna modifica necessaria).
- **Retention**: Umami → Report → Retention, nessuna configurazione richiesta (report nativo su pageview).

## Test

- `resolveRumPage`: mappa ogni route nota, fallback `"altro"` su path non riconosciuto — funzione pura, testata come le altre utility di route/whitelist del progetto.
- `recordWebVital`: conversione ms→s per LCP/INP, passthrough per CLS, istogramma giusto per ogni `metric` (pattern di `lib/observability/metrics.test.ts`).
- Route `/api/rum`: payload valido → 204 e istogramma aggiornato; `metric`/`page` fuori enum → 400, nessuna label spuria scritta; nessun test DB (la route non tocca il DB).

## Fuori scope (esplicito)

- Session replay, heatmap: rimandati, serve un tool nuovo (es. PostHog self-hosted) — da brainstormare a parte se/quando l'utente lo chiede.
- Campionamento del RUM: non necessario al volume di traffico attuale, da rivedere se l'app cresce.
- FCP/TTFB: non tracciati in questa fase, aggiungibili in futuro con lo stesso schema (nuovo istogramma + callback `web-vitals`) se emerge un bisogno specifico.
