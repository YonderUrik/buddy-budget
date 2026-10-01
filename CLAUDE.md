# BuddyBudget

App di gestione finanziaria personale. Multi-lingua e multi-valuta: lingua e valuta sono scelte dall'utente in fase di onboarding (default italiano/EUR, non hardcoded). L'italiano resta la lingua di lavoro per ora perché l'i18n non è ancora implementato.

## Regole per Claude

- **Operazioni git libere** (decisione del 2026-07-21, revoca la regola precedente): Claude può eseguire qualunque comando git in questa repo, incluse operazioni prima riservate all'utente (`merge`, `push`, `branch -d`, rimozione worktree, ecc.), senza dover chiedere conferma ogni volta. Restano valide le linee guida generali di cautela per azioni distruttive/difficili da annullare (es. confermare prima di `push --force`, `reset --hard`, eliminare branch con lavoro non mergiato).
- **Schema DB solo via migration versionate** (decisione del 2026-09-26, Fase 0 migrazione VPS): `db:push` non esiste più. Ogni modifica allo schema (`lib/db/schema/`) richiede `pnpm db:generate` + migration committata + `pnpm db:migrate` sul DB di sviluppo, poi (finché si è su Neon) sul DB di produzione **prima** del merge che la usa.
- **Fai domande di approfondimento solo quando la richiesta è ambigua o ha un impatto rilevante** (scelte architetturali, comportamento non specificato, più interpretazioni plausibili). Per richieste chiare o di portata limitata, procedi direttamente senza chiedere conferma: l'obiettivo è non rallentare il lavoro con domande superflue.
- **Ogni feature, bug, debito tecnico, task o verifica manuale va segnato su Slack** (decisione del 2026-09-27): nella Slack List "BuddyBudget — Backlog" (https://buddybudget.slack.com/lists/T0C5LCECH6U/F0C4THFDKD0, canale privato `#bb-backlog`, id `C0C4THFBUBU`). Vale sia per gli elementi nuovi (idea, bug trovato, debito emerso in una review, scope rimandato) sia per i cambi di stato (Da fare → In corso → Fatto, Sospeso, Scartato) — a fine lavoro va aggiornata la riga corrispondente. Finché il connettore Slack non permette di aggiungere righe alla lista (oggi `add_list_record` fallisce con `bot_not_found`), Claude pubblica l'elemento o l'aggiornamento come messaggio in `#bb-backlog` (titolo, tipo, stato, priorità, area, perché, link) e lo segnala all'utente, che lo riporta nella lista. Non sostituisce il log delle decisioni qui sotto: la lista dice *cosa* c'è da fare e a che punto è, il log *perché* si è deciso.
- **Ogni feature nuova o cambiata aggiorna la landing** (decisione del 2026-10-01): `lib/features/catalog.ts` è l'unico elenco delle funzioni (landing su buddybudget.io, pannello "In arrivo" del login, test della sidebar). Quando una funzione viene rilasciata, cambia o viene pianificata si aggiorna quel file e si lancia `pnpm sync:features` in `landing/` (la CI fallisce se la copia generata diverge); se cambia il racconto (passi del tour in `landing/content/site.ts`, righe del confronto) si aggiorna anche quello. Una feature non è "completata" finché la landing non la riflette, e la PR lo dichiara (anche solo "nessun impatto sulla landing").
- **Mantieni questo file aggiornato.** Ogni volta che viene presa una decisione di progetto, cambiata una scelta tecnica, o completata una fase di lavoro rilevante, aggiungi una voce breve (3-8 righe, in cima) a [`docs/decision-log.md`](docs/decision-log.md) e aggiorna "Stato del progetto" qui sotto se cambia lo stato generale. I dettagli di un lavoro vanno nella sua spec/piano in `docs/superpowers/`, non qui. L'obiettivo è che una nuova chat possa leggere questo file e avere subito il contesto, senza dover richiedere all'utente di ripetere spiegazioni già date.
- **Tieni sempre traccia esplicita di tre cose, in "Stato del progetto" e/o nei documenti di spec/piano collegati**: (1) cosa si sta facendo adesso, (2) cosa si è deciso consapevolmente di saltare/rimandare e perché, (3) cosa è previsto in futuro e quando tornarci. Non lasciare che uno scope tagliato o un piano messo in pausa si perda nella conversazione: se un piano viene sospeso (es. per cambiare priorità), aggiorna il suo stato nel file stesso invece di lasciarlo silenziosamente incompleto.

## Principi di architettura

### Riusabilità

Ogni modulo, componente o funzione scritto per questa applicazione deve essere progettato per poter essere riutilizzato:
- **Props esplicite invece di dipendenze hardcoded**: un componente non deve fare assunzioni sul contesto in cui viene usato. Dati che possono variare (voci di navigazione, etichette, href, callback) vengono passati come prop con valori di default sensati.
- **Nessuna dipendenza ciclica tra layer** (vedi sezione "Organizzazione a layer" sotto).
- **Barrel file** per ogni cartella feature (`index.ts`): chi importa da fuori usa sempre il barrel, mai i file interni direttamente. Questo permette refactoring interni senza rompere i consumatori.
- **Tipi esportati**: ogni interfaccia/tipo usato nelle props di un componente pubblico va esportata, per permettere ai chiamanti di tipizzare i dati senza duplicare le definizioni.

### Manutenibilità

- **JSDoc minimo obbligatorio** su ogni componente e funzione pubblica: una riga di `/**` che descriva cosa fa, i casi d'uso non ovvi e le prop significative. Non commentare ciò che il codice già dice da solo.
- **Separazione stato / UI**: la logica di stato (Context, hook, calcoli) vive in file separati rispetto ai componenti JSX. I componenti UI ricevono dati già pronti via props.
- **Nessun valore hardcoded nei componenti** che non sia un default di prop: colori → token tema, testi visibili → prop o costanti named, soglie numeriche → costanti con nome (`const SIDEBAR_MOBILE_BREAKPOINT = 768`).
- **Un componente, una responsabilità**: se un file supera ~150 righe di JSX o fa più di una cosa distinta, va diviso.
- **Nessuna logica di business nei file di route** (`app/*/page.tsx`): le pagine orchestrano componenti, non implementano calcoli.

### Organizzazione a layer

I componenti sono organizzati in 3 layer con dipendenze unidirezionali (i layer alti dipendono da quelli bassi, mai il contrario):

```
┌─────────────────────────────────────────────┐
│  app/ (route e pagine Next.js)              │  layer 3 — orchestrazione
│    └─ usa: layout + domain + ui             │
├─────────────────────────────────────────────┤
│  components/domain/ (dominio finanziario)   │  layer 2 — business UI
│    └─ usa: ui                               │
│  components/layout/ (struttura pagina)      │  layer 2 — struttura
│    └─ usa: ui, context propri               │
├─────────────────────────────────────────────┤
│  components/ui/ (primitive shadcn)          │  layer 1 — primitive
│    └─ nessuna dipendenza interna al progetto│
└─────────────────────────────────────────────┘
```

- `components/ui/` — primitive shadcn/ui. Non modificare a mano salvo adattamenti ai token.
- `components/layout/` — struttura della pagina (shell, sidebar, topbar). Non deve conoscere il dominio finanziario.
- `components/domain/` — componenti con logica di dominio (StatCard, grafici, form finanziarie). Composte da primitive `ui/`.
- `app/` — route App Router. Le pagine importano da tutti e tre i layer e li orchestrano.

### Operazioni lunghe: job in background con avanzamento visibile (standard)

Standard deciso il 2026-09-22 (primo caso: import/sync GoCardless). Qualunque operazione che può durare più di qualche secondo (import, sync, ricalcoli massivi, backfill avviati dall'utente) **non** si esegue dentro la richiesta HTTP bloccando l'utente con uno spinner. Si usa questo schema:

1. **La route crea un job e risponde subito** con `{ jobId }` (validazioni/ownership/eleggibilità restano sincrone, prima del job: un errore prevedibile deve arrivare come risposta HTTP, non come job fallito).
2. **Il lavoro gira in `after()` di Next.js** (`next/server`), con `export const maxDuration` esplicito sulla route. Funziona sia su Vercel serverless (tiene viva la funzione fino a `maxDuration`) sia su un server Node persistente — nessuna dipendenza da infrastruttura solo-Vercel (Workflow/Queues) finché il deploy futuro su VPS resta un'ipotesi.
3. **Stato del job su Redis** (effimero, TTL 24h, chiave per utente), non in una tabella Postgres: niente migrazioni, pulizia automatica. Lo stato contiene fase e **contatori reali** (es. `processed`/`total`), mai un avanzamento stimato a tempo.
4. **Heartbeat**: ogni aggiornamento scrive `updatedAt`; un job `running` con heartbeat più vecchio di una soglia è trattato come interrotto (la funzione può morire per timeout). Per questo il lavoro dev'essere **idempotente e riprendibile**.
5. **Il lavoro procede a blocchi** (es. insert batch da 50 righe), sia per performance (niente una query per elemento) sia per avere avanzamento granulare ("Inserite 120 su 500").
6. **Il client interroga lo stato via polling** (TanStack Query, `refetchInterval` attivo solo mentre esistono job in corso) da un **indicatore globale montato nel layout**, così l'avanzamento resta visibile cambiando pagina; a job concluso mostra un riepilogo.
7. La funzione di dominio che fa il lavoro accetta una callback `onProgress` opzionale, così resta riusabile senza job (cron, script, test).

Deroghe solo per motivi espliciti, da annotare nel log delle decisioni.

### Osservabilità: log, metriche, eventi (standard)

Standard deciso il 2026-09-27 (Fase A osservabilità, spec `docs/superpowers/specs/2026-09-27-osservabilita-app-fase-a-design.md`). Tutto il codice server segnala cosa succede tramite `lib/observability`, mai con `console.*` (bloccato da ESLint `no-console`; eccezione: gli script CLI in `lib/db/`).

1. **Log**: si usa `logger` (fuori dalle richieste) o `requestLogger()` (dentro una route, eredita `requestId`/`route`/`user`). Una riga JSON per evento, con `event` nel formato `dominio.oggetto.esito` (es. `gocardless.sync.failed`). Si passano solo i campi del tipo chiuso `LogFields`: se serve un campo nuovo va aggiunto lì, ragionando sul fatto che non porti dati personali.
2. **Mai nei log né nelle etichette delle metriche**: email, nomi, IBAN, importi, descrizioni/note delle transazioni, nomi dei merchant, token/segreti, cookie, body delle richieste, `userId` in chiaro. L'utente compare solo come `user` = `hashUserId(id)`, e mai come label. I messaggi d'errore passano da `redactText` (email, IBAN, UUID, bearer, `params:` di Drizzle), ma è una rete di sicurezza e non il meccanismo principale.
3. **Ogni nuova route API** si esporta come `export const GET = withRoute("<risorsa>.<azione>", handleGet)`, con un nome **statico** (mai il path con gli id: finisce nelle etichette delle metriche). Nelle route autenticate si chiama `bindRequestUser(session.user.id)` subito dopo il controllo della sessione. Probe e scrape usano `{ quietOnSuccess: true }`.
4. **Metriche**: prefisso `buddybudget_`, unità nel nome (`_seconds`, `_total`), etichette solo da enum chiusi (funzioni `record*` di `lib/observability/metrics.ts`, non oggetti prom-client grezzi). Tutto ciò che deve valere tra più pod o sopravvivere a un riavvio (ultimo successo di un cron, job in corso) sta su Redis (`OpsStore`) e viene letto allo scrape.
5. **Cron**: ogni cron chiama `recordCronRun(nome, esito, durata, { store })`, che scrive anche l'heartbeat usato dagli alert "cron non eseguito".
6. **Eventi di prodotto**: `track()` di `lib/analytics` (Umami) dopo l'esito positivo di un'azione, con props solo categoriche o conteggi. I nomi evento sono un tipo chiuso (`ProductEvents`).
7. `GET /api/metrics` risponde solo con `Authorization: Bearer <METRICS_TOKEN>`; senza `METRICS_TOKEN` risponde 404 (così su Vercel resta spento).

#### Ogni feature è osservabile (definition of done)

Regola decisa il 2026-10-01: una feature non è "completata" finché in produzione non si può **vedere cosa succede** e **capire come sta andando**. Prima di chiuderla (e di aprire la PR) si risponde a queste domande, e la PR le riporta in una riga ciascuna:

1. **Log**: ogni esito che conta (successo di un'azione importante, ogni errore gestito, ogni fallback) ha un evento `dominio.oggetto.esito` via `requestLogger()`/`logger`, filtrabile in Loki con una query. Le route nuove sono `withRoute`.
2. **Umami**: ogni azione dell'utente che la feature introduce o cambia ha un evento in `ProductEvents` e un `track()` dopo l'esito positivo (anche modifica ed eliminazione, non solo creazione), con props solo categoriche o conteggi. Serve a capire se la feature viene usata, non solo se funziona.
3. **Metriche e alert**: se la feature ha un lavoro in background, un cron o una dipendenza esterna (API, fonte dati, email), ha una metrica con `record*` e `recordCronRun`, e se può fallire senza che l'utente se ne accorga ha un alert nel repo infra (regola in `argocd/apps/grafana.yaml` + runbook in `docs/runbooks/`).
4. **Dashboard e guida**: se aggiunge metriche, un pannello nella dashboard giusta (repo infra) e una riga in `docs/osservabilita.md`.
5. **Dopo il deploy**: nella PR, "Come verificare in produzione": quale query Loki, quale metrica e quale evento Umami guardare, e che valori aspettarsi.

Un cambiamento puramente grafico o di calcolo senza nuovi esiti osservabili può dichiarare "nessun nuovo segnale" nella PR, ma va dichiarato, non omesso.

## Stack

- Next.js (App Router) + TypeScript
- pnpm come package manager
- Tailwind CSS v4 + shadcn/ui (stile `base-nova`, componenti su `@base-ui/react`, icone `lucide-react`)
- `next-themes` per il tema chiaro/scuro

Livello applicativo (deciso in `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`, implementato):

- **Database**: Postgres self-hosted (container in cluster) + **Drizzle ORM**
- **Autenticazione**: better-auth (magic link + Google OAuth), email transazionali via Resend
- **API**: Next.js Route Handlers, consumate lato client con **TanStack Query**
- **State management**: React Context per stato UI locale, TanStack Query per stato server; Zustand solo se emerge un bisogno concreto
- **Cache**: Redis (rate limiting auth + cache calcoli derivati costosi)
- **Charts**: Recharts via componente `Chart` di shadcn/ui
- **Osservabilità**: VictoriaMetrics + Loki + Alloy + Grafana, Umami per gli eventi di prodotto (vedi standard sopra e `docs/osservabilita.md` nel repo infra)
- **Deployment**: cluster k3s single-VPS (Hostinger, Düsseldorf), provisioning Ansible, ArgoCD + SOPS/KSOPS, ingresso via Cloudflare Tunnel + Traefik, admin solo via Tailscale. **Dal 2026-09-27 la produzione è su k3s** (dal 2026-10-01 in corso il passaggio a `buddybudget.io` = landing statica in `landing/` su Cloudflare Pages, `app.buddybudget.io` = app: vedi `docs/decision-log.md`); Vercel e Neon sono spenti (rotazione segreti e chiusura definitiva: Task 8 della Fase 7, vedi Stato). Il codice resta portabile anche su serverless (niente processi in memoria di lunga durata, cron come endpoint `/api/cron/*`). Repo infra: `YonderUrik/buddy-budget-infra`.
- **CI/CD**: GitHub Actions (lint, tsc, test) → immagine su GHCR → la CI aggiorna il tag nel repo infra → ArgoCD fa il rollout. Le migration le applica un Job `PreSync` di ArgoCD prima del rollout.

## Comandi

```
pnpm dev      # server di sviluppo
pnpm build    # build di produzione
pnpm lint     # ESLint
pnpm test              # vitest (usa DATABASE_URL: DB di sviluppo, o un DB vuoto migrato)
pnpm db:generate        # genera una migration dallo schema TypeScript (dopo ogni modifica a lib/db/schema)
pnpm db:migrate         # applica le migration pendenti (DATABASE_URL da env o .env.local)
pnpm db:mark-baseline   # una tantum: registra la baseline su un DB esistente già allineato
docker build -t buddy-budget:local .   # immagine dell'app (target migrator: --target migrator)
```

## Struttura

```
app/                         route App Router
  (auth)/                    login, onboarding (senza AppShell)
  (app)/                     schermate con AppShell: panoramica, conti, movimenti (elenco/analisi/categorie/regole),
                             categorizza, investimenti (6 schede + titoli), debiti, impostazioni, style-guide
  api/                       route handler (tutti con withRoute), cron in api/cron/*
  globals.css                design token (CSS variables) e theme Tailwind
components/
  ui/                        primitive shadcn (layer 1)
  layout/                    shell, sidebar, topbar (layer 2 — struttura; barrel index.ts)
  domain/<feature>/          componenti di dominio per feature (layer 2), ognuno con barrel
lib/
  db/schema/ + migrations/   schema Drizzle e migration versionate
  calc/                      motori di calcolo puri e testati (spese, cashflow, rendimenti, tasse, ammortamento, debiti...)
  observability/ analytics/  log, metriche, eventi di prodotto
  <feature>/                 logica di dominio per area (gocardless, categorization, investments, market-data, net-worth, debts, account...)
landing/                     sito vetrina statico (buddybudget.io), progetto Next.js a sé con proprio package.json, CI e immagine nginx nel cluster k3s (non Cloudflare Pages); contenuti in landing/content/
docs/
  product-vision.md          visione di prodotto (sintesi)
  functional-spec.md         specifica funzionale per schermata, dedotta dal mockup
  decision-log.md            log storico delle decisioni (dettaglio per data)
  design-reference/          mockup originale
  superpowers/specs|plans/   spec e piani di ogni feature
```

## Design token

Tutti i colori, font e raggi sono definiti come CSS variables in `app/globals.css` (`:root` per il tema chiaro, `.dark` per lo scuro), estratti dal mockup in `docs/design-reference/mock-up.html`. Le variabili sono esposte a Tailwind tramite il blocco `@theme inline`, quindi sono disponibili come classi utility (`bg-background`, `text-foreground`, `bg-primary`, `text-pos`, `bg-neg-soft`, `rounded-xl`, ecc.).

**Regola**: non usare mai colori esadecimali o valori di raggio hardcoded nei componenti. Usa sempre i token del tema (classi Tailwind o `var(--nome-token)`). Se serve un nuovo token, aggiungilo in `globals.css` (sia per `:root` che per `.dark`) invece di introdurre un valore una tantum.

Token specifici per l'ambito finanziario (oltre a quelli standard shadcn):
- `--pos` / `--pos-soft`: importi positivi, entrate
- `--neg` / `--neg-soft`: importi negativi, spese
- `--text-2` / `--text-3`: livelli di testo secondario/terziario

Font: `font-heading` (Space Grotesk) per titoli e cifre in evidenza, `font-sans` (Hanken Grotesk) per il resto del testo.

## Convenzioni componenti

- I componenti shadcn si aggiungono con `pnpm dlx shadcn@latest add <nome>` e vivono in `components/ui/`; non modificarli a mano se non per adattarli ai token del tema.
- I componenti compositi specifici del dominio (es. `StatCard`) vivono in `components/` e vanno costruiti componendo le primitive di `components/ui/`.
- Tutte le stringhe visibili all'utente sono in italiano per ora (l'app è multi-lingua per design, ma l'infrastruttura di i18n non è ancora implementata — vedi "Stack" e log delle decisioni). Quando si introdurrà l'i18n, queste stringhe andranno estratte in chiavi di traduzione invece di restare hardcoded nei componenti.

### Schermate "in arrivo" e catalogo funzionalità: punti da aggiornare quando se ne implementa una

Elenco, area, descrizioni e stato (`live` / `new` / `soon`) di tutte le funzionalità stanno in **un solo posto**: `lib/features/catalog.ts`. Lo leggono il pannello "In arrivo" del login (`components/domain/auth/upcoming-features.data.ts`, che aggiunge solo l'icona) e la landing, che ne tiene una copia generata (`landing/content/catalog.generated.ts`, aggiornata con `pnpm sync:features` in `landing/`; la CI controlla l'allineamento). Il pannello del login mostra le funzionalità `soon` che hanno `appPath` (le schermate). Il test `lib/features/catalog.test.ts` fallisce se la sidebar e il catalogo divergono.

Quando si implementa una schermata pianificata (oggi: Pensione, Pianifica, Analitiche):

1. `components/layout/sidebar.tsx` → `NAV_ITEMS`: **togliere `comingSoon: true`** e verificare che `href` corrisponda alla route reale.
2. `lib/features/catalog.ts`: passare la voce da `soon` a `new` o `live` (e aggiornare la descrizione se serve); togliere l'icona da `UPCOMING_ICONS` nel file dati del login; poi `pnpm sync:features` in `landing/`.
3. Una **feature nuova** (non pianificata) si aggiunge al catalogo come `new` (poi `live`) e si lancia il sync: la landing la mostra da sola, ma va controllato che il testo regga nella pagina.

Una schermata o feature nuova non è "completata" finché il catalogo non è aggiornato, insieme a "Stato del progetto" qui sotto.

## Stato del progetto

Aggiornato al 2026-10-01. Il dettaglio storico di ogni lavoro è in [`docs/decision-log.md`](docs/decision-log.md) e nella spec/piano corrispondente in `docs/superpowers/`.

### Fatto (tutto su `main`, in produzione su k3s)

- **Base**: autenticazione (better-auth, magic link + Google), onboarding, Conti (manuali + Open Banking GoCardless con sync manuale e cron), Panoramica con patrimonio netto per classe di asset, login con pannello "mosaico", brand identity e PWA installabile, pulsante "nascondi importi", pagina Impostazioni (profilo, sessioni, export ZIP, reset, disattivazione con 30 giorni, eliminazione), etichetta versione in sidebar, sidebar con riepilogo finanziario.
- **Movimenti** (`/movimenti`: Elenco · Analisi · Categorie · Regole): transazioni, entrate/uscite, "Dividi", note, budget per categoria, gruppi di spesa (Dovute/Volute/Te futuro/Saltuarie), categorizzazione automatica a regole e pagina `/categorizza`, import e sync come job in background con avanzamento.
- **Investimenti** (Fasi 1-4 e 6 + import CSV): fonti di prezzo gratuite con riserva automatica, operazioni, PAC, rendimenti e benchmark, rischio e diversificazione, fiscalità italiana, Proventi, Titoli con watchlist e avvisi di prezzo. Cron `market-prices` 3 volte al giorno.
- **Debiti**: Fase 1 (motore e finanziamenti, PR #36), Fase 2 (estinzioni anticipate, PR #38). Fasi 3 e 4 implementate nella PR #43 (vedi "In corso").
- **Infrastruttura**: migrazione Vercel+Neon → VPS k3s completata (Fasi 0-7, cutover il 2026-09-27). Osservabilità Fasi A e B completate (log JSON, metriche, 4 dashboard, 12 alert con runbook, Slack `#bb-allarmi`/`#bb-avvisi`/`#bb-deploy`).

### In corso

- **Connessioni GoCardless**: avvisi di scadenza (banner + email, `/conti?rinnova=1`) e cron `gocardless-maintenance` che ripulisce la lista su GoCardless. PR in bozza; il cron parte in **dry-run** e va portato a `execute` a mano (`GOCARDLESS_CLEANUP_MODE` nel Secret) dopo qualche giorno di dry-run. Vedi `docs/decision-log.md` 2026-10-01.
- **Debiti**: Fasi 3 (credit Lombard) e 4 (patrimonio netto, Lombard contro il portafoglio, scheda Simulatore) implementate, PR #43 in revisione. Spec `docs/superpowers/specs/2026-09-30-debiti-design.md`. Quando una fase cambia stato, aggiornare questa riga.

### Previsto

- **Landing** (`landing/`): sito statico servito da nginx nel cluster (namespace `app`, immagine `buddy-budget-landing`, manifest infra `argocd/manifests/landing`). Sito Umami "BuddyBudget Landing" creato (id nel Dockerfile). **Da fare, in quest ordine**: (1) spostare l app su `app.buddybudget.io` (`APP_URL`/`BETTER_AUTH_URL` nel Secret, redirect URI Google OAuth); (2) switch dell apice: togliere `apex-redirect-www` e puntare `Host(buddybudget.io)` al Service `landing`; (3) immagine Open Graph, validare testi di storia e confronto. Vedi `docs/decision-log.md` 2026-10-01.

- **Osservabilità Fase C**: accesso in sola lettura per agenti via MCP (mai sulla VPS di produzione).
- **Fase 7, Task 8 (migrazione VPS)**: non prima di 2 settimane dal cutover (cioè dopo il 2026-10-11) e con conferma esplicita dell'utente: rotazione di tutti i segreti (sono transitati su Vercel), chiusura definitiva di Vercel/Neon, rimozione di `@vercel/analytics` e delle chiavi Umami inutilizzate dall'env. Piano: `docs/superpowers/plans/2026-09-27-fase-7-cutover.md`.
- **Sezione Budget separata**: oggi il budget per categoria vive nella legenda della torta in Movimenti. Serve un brainstorming dedicato (cambio di IA e data-model).
- **Schermate non implementate**: Pensione, Pianifica, Analitiche (vedi "Schermate in arrivo").
- **i18n**: lingua e valuta sono scelte in onboarding, ma le stringhe sono ancora tutte in italiano; serve scegliere la libreria ed estrarre le stringhe.
- **Backlog**: tracciato su Slack in `#bb-backlog` (vedi Regole). Lì ci sono anche idee e debiti minori.

### Rimandato consapevolmente

- **Investimenti**: OpenFIGI per ISIN→ticker, più portafogli per utente, ritenute estere e quadri della dichiarazione, notifica push PWA per gli avvisi, preset di import per un broker italiano (serve un export d'esempio), undo dell'import, screener (escluso), correzione dello storico attorno a uno split, aree degli ETF dai file degli emittenti, ribilanciamento con vendite, Sortino/VaR.
- **Debiti**: aggiornamento automatico Euribor, valute estere, tasso misto/cap, debiti informali, push sulle scadenze, quota capitale/interessi nel Cash flow, modifica dei dati di un debito dalla UI, ordinamento dei debiti.
- **Impostazioni**: cambio email, scollegare Google, notifiche email, import dell'export.
- **Sidebar**: popover al passaggio del mouse sul chip compresso, sezione "Prossimi eventi", sezioni riordinabili, eventuale sidebar a gruppi (alternativa B).
- **Infra**: alert sul backup Postgres fallito (servono le metriche CNPG), Claude Code sempre attivo (mai sulla VPS di produzione), Paperclip, staging, multi-nodo, ChatOps su Slack, sottodominio `buddybudget.io` per gli strumenti dietro Tailscale (serve cert-manager con DNS-01), `PasswordAuthentication` SSH ancora attiva (da chiudere con un secondo dispositivo).
- **Cash flow/Movimenti**: mostrare il passato nel grafico del residuo dei debiti, annulla per la categorizzazione in blocco, scorciatoie da tastiera in `/categorizza`.

### Da verificare a mano (a carico dell'utente)

- **Categorie**: `pnpm db:reset-categories --dry-run` poi reale (se non già fatto); controllare i 4 gruppi in `/movimenti/categorie`, drag & drop, dialog, mobile e tema scuro (il redesign non è stato provato in browser).
- **Investimenti**: probe delle fonti (`pnpm tsx scripts/probe-price-sources.ts` da locale e VPS), Yahoo vero (ricerca, numeri chiave, storico dividendi, settori ETF), Eurostat (`inflation_index`), BCE €STR (`interest_rates`), `COINGECKO_API_KEY` da aggiungere come secret SOPS nel repo infra, un avviso di prezzo reale (email Resend), stime fiscali contro il rendiconto Fineco, tasso e scadenza dei BTP, un benchmark vero (es. VWCE).
- **Debiti**: tasso e TAEG calcolati contro un contratto vero, pregresso dall'origine contro fotografia, penali e rate di un'estinzione reale, transazioni collegate dal picker con dati GoCardless veri.
- **Impostazioni**: email di disattivazione/eliminazione e revoca GoCardless in produzione, "Collega Google". Il CronJob `account-deletion` del repo infra va mergiato solo con l'immagine che contiene la route in produzione (verificare se già fatto).
- **Login mosaico**: Safari e Firefox (il morph dei path), altezza a 1366×768.
- **Prezzi**: nei log (`market.prices.updated`) devono girare i 3 giri al giorno senza 429 nuovi; backup CNPG non più orario (`kubectl get backups -n data`) e spazio R2 in calo.
- **Redirect** dai vecchi indirizzi (`/spese`, `/transazioni`, `/cash-flow`, `/categorie`) e dialog "Aggiungi" in Movimenti.

### Debito tecnico noto

- Lo storico della liquidità nel patrimonio netto è ricostruito una volta sola: un conto manuale aggiunto dopo compare come salto nell'ultimo giorno.
- Il matching per similarità nel wizard "Categorizza automaticamente" non scarta le parole generiche (es. "pagamento pos"); ogni suggerimento resta comunque confermato a mano.
- Nel PATCH di una transazione che cambia direzione via `categoryId` senza inviare `excludedAmount`, il valore salvato per la vecchia direzione può far rifiutare l'aggiornamento (fail-safe, nessuna corruzione).
- `resolveDbSsl` può lanciare su URL Postgres multi-host; lo stage `migrator` del Dockerfile non forza TLS; il cron GoCardless non ha un budget di tempo dentro `maxDuration`.
- `InvestmentsTabs` ha ancora una copia propria del componente schede (`SectionTabs` è quello condiviso): da unificare.
- La maschera di "nascondi importi" copre solo ciò che passa da `formatCurrency` (restano in chiaro quantità, percentuali e alcuni formatter locali).
- better-auth scrive i propri errori interni su console, fuori dal nostro `logger`: da rivalutare guardando i log in Loki.

### Note operative (lezioni da non ripetere)

- `git fetch origin main` prima di fidarsi di un confronto con `origin/main`; i worktree partono da lì e possono essere indietro.
- `pnpm db:migrate` va eseguito nella directory del branch che ha introdotto la migration, mai dalla repo principale con un altro branch. Rinominare cartelle in `app/` con `pnpm dev` acceso manda Turbopack in loop: fermarlo e cancellare `.next`.
- Più sessioni possono scrivere su `main` insieme: `git status` subito prima di ogni commit, `git stash list` prima di ogni `stash pop`.
- Un subagent può lavorare fuori dal worktree indicato: verificare sempre il diff reale, non il suo report. Con `isolation: "worktree"` il path nel prompt viene ignorato.
- Verificare con i dati veri e in browser, non solo con `tsc` e i test: molti bug (select che mostrano l'id, `pathLength` con tratteggi, overflow dell'XIRR) sono comparsi solo dal vivo. Una "fonte che risponde" dal sandbox cloud non dice nulla sulla produzione: il sandbox non raggiunge Yahoo, BCE, Eurostat né GoCardless reale.
- Yahoo risponde 429 all'impronta TLS di Node: le fonti di mercato passano da `browserTlsFetch`. Nei test di rete usare sempre URL mai chiesti (le risposte in cache CDN danno falsi 200).
- Lo `ScheduledBackup` di CNPG usa un cron a 6 campi (secondi per primi); i CronJob k8s a 5. Il chart Grafana passa i values di alerting a `tpl`: i `{{ }}` dei template Grafana vanno protetti.
- Ogni nuovo servizio esposto via Tailscale Ingress in un namespace con default-deny richiede la sua NetworkPolicy per il namespace `tailscale`, nello stesso commit dell'Ingress. Dopo aver corretto un errore di manifest, ArgoCD può mostrare quello vecchio finché non si fa Hard Refresh.

## Log delle decisioni

Il log completo è in [`docs/decision-log.md`](docs/decision-log.md) (voci nuove in cima, 3-8 righe). Decisioni ancora vincolanti, in sintesi:

- **2026-10-01** — Connessioni GoCardless: avvisi di scadenza (7 giorni prima, email + banner) e pulizia giornaliera della lista GoCardless con periodi di grazia (3/7/30 giorni), dry-run di default, mai su utenti con eliminazione programmata.
- **2026-10-01** — Ogni feature deve essere osservabile (log, evento Umami, metriche/alert se serve, riga "Come verificare in produzione" nella PR): vedi "Osservabilità" sopra.
- **2026-10-01** — Prezzi di mercato e snapshot del patrimonio a 3 giri al giorno (06:30/17:30/22:30 UTC e 06:50/17:50/23:50 UTC). Sono chiusure di fine giornata, non intraday.
- **2026-09-30** — Sezioni unificate: Transazioni, Cash flow e Categorie sono `/movimenti`. Categorie con board a colonne per gruppo di spesa.
- **2026-09-30** — Debiti: piano calcolato da condizioni iniziali + registro eventi (come le posizioni di Investimenti); rate segnate a mano, mai automatiche.
- **2026-09-29** — Investimenti: posizioni sempre calcolate dalle operazioni (costo medio ponderato), mai salvate; il PAC precompila e non genera operazioni. Il patrimonio netto storico degli investimenti si ricalcola da solo quando cambiano i dati.
- **2026-09-28** — Fonti di mercato: `browserTlsFetch` per tutte (impronta TLS di Node bloccata da Yahoo).
- **2026-09-27** — Osservabilità: stato dei cron e dei job su Redis, mai in memoria del pod; canali Slack separati per gravità.
- **2026-09-27** — Brand: sidebar navy fissa in entrambi i temi; verde/rosso di entrate/uscite non fanno parte del brand.
- **2026-09-26** — Schema DB solo via migration versionate; infrastruttura su VPS con k3s, GitOps, SOPS, Postgres con CloudNativePG e backup su R2.
- **2026-09-23** — Gruppi di spesa al posto di fissa/variabile (Dovute, Volute, Te futuro, Saltuarie); "Avanzo" è ciò che resta dopo i gruppi.
- **2026-09-20** — Categorizzazione a regole merchant, mai auto-applicate se non da regola esplicita; la categoria di fallback si riconosce dal flag `isFallback`, non dal nome.
- **2026-07-21** — Operazioni git libere per Claude (restano le cautele sulle azioni distruttive).
- **2026-07-03** — Multi-lingua e multi-valuta per design; architettura a 3 layer; niente Server Actions, Route Handlers con TanStack Query.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
rtk uv run <cmd>        # Compact uv project command output
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->