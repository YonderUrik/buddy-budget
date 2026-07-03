# Architettura tecnica di BuddyBudget

**Data**: 2026-07-03
**Stato**: approvato

## Contesto

Il progetto è attualmente in fase di design system + layout shell (vedi `CLAUDE.md`). Le 9 schermate funzionali (Panoramica, Conti, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche — vedi `docs/product-vision.md` e `docs/functional-spec.md`) richiedono un livello applicativo completo: persistenza dati, autenticazione multi-utente, API, e un ambiente di deployment. Questo documento fissa le scelte tecnologiche e architetturali per costruire quel livello, così che l'implementazione parta da decisioni esplicite invece che da default impliciti.

Non copre il modello dati di dominio (conti, transazioni, categorie, budget, obiettivi) né la sequenza di implementazione delle schermate: quello è oggetto di un piano/spec successivo.

## Vincoli di partenza

- Hosting **self-hosted su VPS**, non piattaforme gestite tipo Vercel.
- App **multi-utente** con autenticazione reale (non mono-utente/famiglia).
- MVP a **inserimento dati manuale**: nessuna integrazione bancaria (Open Banking) o di mercato live — già segnato fuori scope in `CLAUDE.md`.
- Chi implementa parte da **poca esperienza Kubernetes**: le scelte favoriscono setup minimale rispetto a configurazioni k8s avanzate.

## Architettura d'insieme

Un singolo cluster **k3s** su un VPS, namespace `production` unico (nessuno staging per ora). Tutti i componenti girano in container nello stesso cluster, tranne l'invio email:

```
┌─────────────────────────────────────────────────────────┐
│ VPS — cluster k3s (namespace: production)               │
│                                                         │
│  ┌──────────────┐   ┌──────────┐   ┌─────────┐           │
│  │ Next.js app   │──▶│ Postgres │   │  Redis  │           │
│  │ (Deployment)  │   │ (PVC)    │   │ (PVC)   │           │
│  │ - UI          │   └──────────┘   └─────────┘           │
│  │ - Route       │                                        │
│  │   Handlers    │   ┌─────────────────────────────┐      │
│  │   (API)       │   │ Prometheus + Loki + Grafana  │     │
│  └──────┬────────┘   └─────────────────────────────┘      │
│         │ Ingress (Traefik, incluso in k3s)               │
└─────────┼─────────────────────────────────────────────────┘
          │
          ▼
      Utenti                          Resend (email magic link,
                                       unico servizio esterno)
```

Un solo Deployment applicativo (frontend + API nello stesso processo Next.js) per ridurre la superficie operativa iniziale. Estrarre un backend separato resta un'opzione futura se emerge un consumer indipendente (es. app mobile), non una scelta anticipata ora.

## Database e ORM

- **Postgres**, containerizzato nel cluster con volume persistente (PVC) per i dati.
- **Drizzle ORM**: query SQL-trasparenti, nessun query-engine binary da includere nell'immagine Docker (a differenza di Prisma), migration gestite con `drizzle-kit`.
- Le migration girano come **Kubernetes Job** (o init container) eseguito prima del rollout del nuovo Deployment, così lo schema è sempre sincronizzato con l'immagine applicativa in arrivo.

**Alternativa scartata**: Prisma — DX più "guidata" (Prisma Studio, migration engine dichiarativo) ma immagine più pesante e meno trasparenza sull'SQL effettivo generato, meno adatto quando si gestisce da soli tutto lo stack infra.

## Autenticazione

- **better-auth**, con due provider di login:
  - **Magic link** via email (nessuna password da gestire/hashare/resettare).
  - **Google OAuth**.
- Invio email transazionali (magic link) tramite **Resend** — unico componente non self-hosted dell'intero stack, scelta deliberata per evitare i problemi di deliverability (SPF/DKIM/DMARC, reputazione IP) di un SMTP self-hosted.
- Sessioni gestite da better-auth su **Postgres** (non su Redis), per tenere la superficie di stato ridotta a un solo store.

**Alternativa scartata**: Auth.js/NextAuth v5 — ugualmente capace (magic link + OAuth + adapter Drizzle), community più ampia e maturità comprovata, ma DX e tipizzazione meno moderne di better-auth; nata per Pages Router e con convenzioni storiche che pesano ancora sull'architettura.

## API e data layer frontend

- API come **Next.js Route Handlers** (`app/api/...`), nello stesso servizio/Deployment del frontend.
- **TanStack Query** lato client per fetching, cache e invalidazione dei dati che arrivano dalle Route Handlers (conti, transazioni, investimenti, ecc.).

Questa è una deviazione consapevole dal pattern "Server Components + Server Actions" più idiomatico in App Router, scelta perché più familiare a chi implementa e perché mantiene aperta la strada a consumer futuri (es. mobile) che parlerebbero con le stesse API REST.

## State management

- Nessuna libreria di stato globale (Redux/Zustand) introdotta preventivamente.
- Stato UI locale/cross-componente semplice → **React Context** (pattern già in uso per `sidebar-context.tsx`).
- Stato server (dati da API) → **TanStack Query**.
- **Zustand** valutato solo se un simulatore what-if (Pianifica/Debiti/Pensione) richiede stato client condiviso tra componenti non annidabili in un Context semplice — introdotto al bisogno, non preventivamente (YAGNI).

## Cache (Redis)

Redis containerizzato nel cluster, con due ruoli scoped fin dal day 1:
1. **Rate limiting** sugli endpoint di autenticazione (richiesta magic link), per prevenire abuso/spam email.
2. **Cache dei calcoli derivati costosi** lato server (es. proiezioni in Analitiche/Pensione/Debiti), con invalidazione esplicita quando cambiano i dati sorgente.

Non usato per sessioni (già su Postgres via better-auth) né per altri scopi finché non emerge un bisogno concreto.

## Charts

**Recharts**, tramite il componente `Chart` ufficiale di shadcn/ui. Eredita automaticamente i token del tema definiti in `app/globals.css` (`--pos`, `--neg`, varianti dark/light) senza styling custom aggiuntivo, e copre tutti i tipi di grafico richiesti dalle schermate: linee (andamento patrimonio), aree (cash flow), donut (composizione portafoglio), radar (radar abbonamenti in Analitiche).

**Alternative scartate**: Tremor (troppo opinionato/dashboard-pronta, meno componibile con lo stile `base-nova` già scelto per il design system), visx (troppo basso livello, costo di implementazione non giustificato dato lo scope).

## Osservabilità

Stack completo fin da subito, come richiesto esplicitamente:
- **Prometheus** — metriche.
- **Loki** — aggregazione log; l'app scrive log strutturati JSON su stdout, raccolti da Loki.
- **Grafana** — dashboard su entrambe le fonti.

Deployato nel cluster tramite i chart/manifest standard della community (es. `kube-prometheus-stack`, stack Loki ufficiale) invece di configurazioni custom da zero.

## CI/CD

**GitHub Actions**, pipeline unica per ora (solo produzione, nessuno staging):
1. Build dell'immagine Docker dell'app.
2. Push su **GHCR** (GitHub Container Registry — gratuito, già integrato col repo, nessun account terzo da configurare).
3. Deploy sul cluster k3s: aggiornamento del Deployment con la nuova immagine, ad ogni merge su `main`.

Le migration Drizzle (vedi sezione Database) girano come step della stessa pipeline, prima dell'aggiornamento del Deployment applicativo.

## Fuori scope per questa fase (deciso esplicitamente, non dimenticato)

- **Staging environment**: solo produzione per ora; namespace/pipeline di staging da aggiungere quando il ritmo di rilascio lo giustificherà.
- **Zustand o altra libreria di stato globale**: introdotta solo se un caso d'uso concreto la richiede.
- **Backend separato dal frontend**: valutato solo se emerge un consumer indipendente (es. app mobile).
- **Integrazione bancaria (Open Banking) e prezzi di mercato live**: già fuori scope per il prodotto in questa fase (vedi `CLAUDE.md`), quindi nessun requisito di sync/job periodico legato a fonti esterne di dati finanziari per ora.

## Testing

Non affrontato in profondità in questo documento: la strategia di test (unit/integration/E2E) sarà definita insieme al piano di implementazione delle singole feature, non come parte dell'architettura infrastrutturale.
