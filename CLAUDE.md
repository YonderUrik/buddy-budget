# BuddyBudget

App di gestione finanziaria personale. Multi-lingua e multi-valuta: lingua e valuta sono scelte dall'utente in fase di onboarding (default italiano/EUR, non hardcoded). L'italiano resta la lingua di lavoro per ora perché l'i18n non è ancora implementato.

## Regole per Claude

- **Non eseguire mai operazioni git** in questa repo (`status`, `add`, `commit`, `push`, `mv`, ecc., incluse le versioni "dry-run" o di sola lettura): è compito esclusivo dell'utente. **Eccezione unica** (decisa il 2026-07-03): dentro un workflow di esecuzione piano automatizzato con subagent (es. `superpowers:subagent-driven-development`), subagent e controller possono eseguire `git add`/`commit`/`diff` **in locale** — mai `push`, mai comandi che riscrivono la cronologia (`rebase`, `reset --hard`, ecc.) — per permettere il meccanismo di commit-per-task e le review basate su diff. Fuori da quel contesto specifico, la regola resta assoluta.
- **Fai domande di approfondimento solo quando la richiesta è ambigua o ha un impatto rilevante** (scelte architetturali, comportamento non specificato, più interpretazioni plausibili). Per richieste chiare o di portata limitata, procedi direttamente senza chiedere conferma: l'obiettivo è non rallentare il lavoro con domande superflue.
- **Mantieni questo file aggiornato.** Ogni volta che viene presa una decisione di progetto, cambiata una scelta tecnica, o completata una fase di lavoro rilevante, aggiungi una voce nella sezione [Log delle decisioni](#log-delle-decisioni) e aggiorna "Stato del progetto" se cambia lo stato generale. L'obiettivo è che una nuova chat possa leggere questo file e avere subito il contesto, senza dover richiedere all'utente di ripetere spiegazioni già date.
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

## Stack

- Next.js (App Router) + TypeScript
- pnpm come package manager
- Tailwind CSS v4 + shadcn/ui (stile `base-nova`, componenti su `@base-ui/react`, icone `lucide-react`)
- `next-themes` per il tema chiaro/scuro

Livello applicativo (deciso in `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`, non ancora implementato):

- **Database**: Postgres self-hosted (container in cluster) + **Drizzle ORM**
- **Autenticazione**: better-auth (magic link + Google OAuth), email transazionali via Resend
- **API**: Next.js Route Handlers, consumate lato client con **TanStack Query**
- **State management**: React Context per stato UI locale, TanStack Query per stato server; Zustand solo se emerge un bisogno concreto
- **Cache**: Redis (rate limiting auth + cache calcoli derivati costosi)
- **Charts**: Recharts via componente `Chart` di shadcn/ui
- **Osservabilità**: Prometheus + Loki + Grafana
- **Deployment**: cluster k3s single-VPS, namespace `production` unico
- **CI/CD**: GitHub Actions → build immagine → push GHCR → deploy su merge a `main`

## Comandi

```
pnpm dev      # server di sviluppo
pnpm build    # build di produzione
pnpm lint     # ESLint
```

## Struttura

```
app/                         route App Router
  globals.css                design token (CSS variables) e theme Tailwind
  layout.tsx                 root layout — monta ThemeProvider + AppShell
  page.tsx                   home placeholder
  style-guide/               pagina di riferimento del design system
components/
  ui/                        primitive shadcn (button, card, badge, input, ...)
  layout/                    struttura pagina (layer 2 — struttura)
    sidebar-context.tsx      Context + hook useSidebar() — stato collapsed/mobile
    sidebar.tsx              AppSidebar — sidebar con 9 voci, collapsed/expanded
    mobile-topbar.tsx        MobileTopbar — hamburger + brand (solo mobile)
    app-shell.tsx            AppShell — compone sidebar + topbar + drawer mobile
    index.ts                 barrel: esporta tutto da un unico punto
  domain/                    componenti con logica di dominio (layer 2 — business UI)
    stat-card.tsx            StatCard — card per importi in evidenza (positivo/negativo)
  theme-provider.tsx         wrapper next-themes
  theme-toggle.tsx           toggle chiaro/scuro
lib/
  utils.ts                   helper `cn`
docs/
  design-reference/mock-up.html   mockup originale (Claude Design) usato come riferimento visivo
  product-vision.md               visione di prodotto (sintesi)
  functional-spec.md              specifica funzionale dettagliata per schermata, dedotta testando il mockup a fondo (cosa si può fare, cosa no, come)
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

## Stato del progetto

Fase di **autenticazione completata**, schermata **Conti implementata** (gestione manuale conti + aspetto personalizzabile), **integrazione Open Banking via GoCardless completata** (16/16 task, già su `main`), e **schermata Spese implementata** (piano `docs/superpowers/plans/2026-07-15-spese-screen.md`, 21/21 task completi, appena mergiata su `main` dal worktree `spese-screen`). Le altre schermate (Panoramica, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche) non sono ancora implementate.

**In corso ora**: nessun piano attivo. Prossimo passo deciso: una sessione `superpowers:brainstorming` dedicata per progettare (1) una sezione **Budget** separata (oggi il budget-per-categoria vive dentro Spese e "prende troppo spazio" secondo l'utente) e (2) **icone/colori per le categorie di spesa** — entrambi cambi di IA/data-model non banali, richiesti dall'utente dopo il test manuale di Spese, non ancora schedulati né implementati.

**Nota tecnica GoCardless** (emersa durante la verifica Task 16): non esiste un bottone "sincronizza" in UI. Il sync scatta solo (a) una tantum al `finalize` del collegamento conto, o (b) via cron automatico ogni 12h (`instrumentation.ts` → `lib/gocardless/scheduler.ts`). Per test manuali fuori da questi due trigger: `pnpm exec tsx -e "import('./lib/gocardless/scheduler').then(m => m.runDueSyncs())"`. Rate limit sandbox ~4 chiamate/giorno per endpoint per conto — oltre soglia, il sync esce silenzioso senza errore.

## Log delle decisioni

Voci in ordine cronologico. Aggiungine una nuova (in cima o in fondo, basta essere coerenti) ogni volta che si prende una decisione degna di nota, invece di lasciare che si perda nella cronologia della chat.

- **2026-07-03** — Definita l'architettura tecnica del livello applicativo (finora assente: solo design system + layout shell erano pronti), documentata in `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`. Decisioni principali: hosting self-hosted su cluster k3s single-VPS (namespace unico `production`, niente staging per ora); Postgres + Drizzle ORM per i dati; autenticazione multi-utente con better-auth (magic link + Google OAuth, email via Resend — unico servizio non self-hosted); API come Next.js Route Handlers consumate con TanStack Query lato client (deviazione consapevole da Server Actions, per familiarità e per lasciare aperta la strada a consumer futuri come un'app mobile); nessuna libreria di stato globale introdotta preventivamente (React Context + TanStack Query bastano, Zustand solo se necessario); Redis con ruolo scoped a rate limiting auth e cache di calcoli derivati costosi; Recharts via componente `Chart` di shadcn/ui per i grafici; osservabilità completa da subito (Prometheus + Loki + Grafana); CI/CD con GitHub Actions → GHCR → deploy su merge a `main`. Il modello dati di dominio e la sequenza di implementazione delle schermate restano da definire in un piano successivo.

- **2026-07-03** — Inizializzato il progetto Next.js (App Router, TypeScript, pnpm) a partire dal mockup `docs/design-reference/mock-up.html`. Scelte fatte: Tailwind CSS + shadcn/ui come stack di styling, dark mode con `next-themes`, scope della fase 1 limitato a design system + style guide (nessuna schermata reale ancora). Documentata anche la visione di prodotto in `docs/product-vision.md`.
- **2026-07-03** — Eseguito e testato interattivamente il mockup (servito via HTTP locale, cliccando ogni bottone/slider/campo di tutte le schermate) perché la sintesi iniziale in `product-vision.md` era incompleta: il mockup ha **9 aree** (Panoramica, Conti, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche), non le 7 elencate inizialmente ("Entrate"/"Budget"/"Risparmi"/"Categorie" non esistono come sezioni a sé, sostituite/ampliate da Cash flow e Pianifica). Prodotto `docs/functional-spec.md` come fonte di verità dettagliata su cosa è realmente funzionante nel mockup (es. simulatori what-if in Pensione/Debiti/Pianifica, editing inline in Conti/Investimenti/Debiti) e cosa è solo scenografia statica (es. tutti i bottoni "+ Aggiungi"/"+ Registra" sono stub tranne "+ Aggiungi conto" in Conti; "Vedi tutti" in Panoramica non fa nulla; il filtro periodo in Spese non filtra la lista transazioni). `product-vision.md` aggiornato con l'elenco corretto delle 9 aree e rimando al nuovo documento.
- **2026-07-03** — Implementata la sidebar collassabile e responsive (`components/layout/`). Comportamento: mobile (<768px) → drawer + topbar hamburger; tablet (768–1023px) → icon-only automatica; desktop (≥1024px) → espansa, collassabile manualmente con stato persistito in localStorage. Introdotta architettura a 3 layer (`ui/` → `domain/` + `layout/` → `app/`) e aggiunte a `CLAUDE.md` le regole di riusabilità, manutenibilità e organizzazione a layer. `stat-card.tsx` spostato in `components/domain/`. Aggiornata `docs/functional-spec.md` per riflettere il comportamento responsive della sidebar.
- **2026-07-03** — Revisionato `docs/functional-spec.md`: ogni voce "Cosa il mockup NON implementa" ora è seguita da una decisione esplicita per il prodotto reale (implementare con quale comportamento, o escludere consapevolmente e perché), invece di lasciare che l'assenza di una funzionalità nel mockup fosse letta come un limite anche per il prodotto. Decisioni principali: tutti gli stub "+ Aggiungi"/"+ Registra" (Spese, Investimenti, Debiti) vanno implementati end-to-end; il selettore periodo in Spese e il meccanismo "Dividi" devono ricalcolare in modo coerente ovunque (un solo motore di calcolo, non dataset scollegati come nel mockup); i conti/transazioni "Auto" restano di sola lettura salvo un'azione esplicita "Scollega" (niente editing arbitrario come nel mockup); l'immobile (oggi solo in Debiti → "Il quadro completo") va reso un'entità di prodotto gestibile, con patrimonio netto mostrato in entrambe le varianti (con/senza immobile); gli scenari in Pianifica devono poter essere personalizzati e salvati con nome; niente simulazioni probabilistiche/Monte Carlo né topbar/notifiche globali (fuori scope, non richieste dal target di prodotto); ricerca globale rimandata a dopo l'MVP. Restano domande aperte genuine (non decise qui, da chiarire con l'utente): multi-utente/multi-piano, integrazione bancaria reale (Open Banking) e integrazione prezzi di mercato live — tutte segnalate esplicitamente nel documento come fuori scope per questa fase, non come decisioni prese.
- **2026-07-03** — Capovolta la decisione precedente su lingua/valuta fisse (`docs/functional-spec.md`, voce "Valuta fissa e lingua fissa" nelle limitazioni trasversali, che dava per confermato italiano/EUR fissi): il prodotto reale deve supportare **multi-lingua e multi-valuta**, non solo italiano/EUR come nel mockup. Lingua e valuta diventano preferenze **per-utente scelte in fase di onboarding** (non un selettore sempre visibile in topbar), con italiano/EUR come default. Restano aperte per un piano successivo: quali lingue/valute supportare al lancio, la libreria di i18n da adottare (impatta anche le stringhe già scritte in italiano nei componenti esistenti, che andranno estratte in chiavi di traduzione) e la strategia di formattazione numeri/date/valuta in base alla preferenza scelta.
- **2026-07-03** — Aggiunta regola su quando fare domande di approfondimento: solo per richieste ambigue o ad alto impatto, non per ogni richiesta, per evitare di rallentare il lavoro.
- **2026-07-04** — Implementata l'autenticazione con better-auth (magic link + Google OAuth, email via Resend). Decisioni principali: 4 tabelle `auth_*` per evitare conflitti col dominio; `auth_user` sostituisce lo stub `users` con campi `currency` e `onboarding_completed` via `additionalFields`; onboarding come pagina dedicata gated da `onboarding_completed = false`; `databaseHooks.user.create.after` semina le categorie di default a ogni nuovo utente; middleware Node.js runtime per proteggere tutte le route; ristrutturazione layout in route group `(app)/` (con AppShell) e `(auth)/` (senza AppShell). Rate limiting Redis, template email HTML e campo `language` rimandati a fasi successive.
- **2026-07-15** — Implementata (Task 1-15 di 16) l'integrazione Open Banking via GoCardless, eseguita con `superpowers:subagent-driven-development` su worktree dedicato. Nuove tabelle `bank_connections`/`bank_account_links`/`gocardless_token`, client HTTP GoCardless, rate limiting Redis, motore di sync idempotente (12h via `node-cron`/`instrumentation.ts`), categorizzazione best-effort delle transazioni importate (categoria di fallback "Da categorizzare"), 6 route API, UI di collegamento/selezione/riconnessione nella schermata Conti. Scoperte e corrette nel processo: la cronologia delle migration era già rotta da prima (schema post-autenticazione mai versionato correttamente) — ricostruita come baseline pulita; un IDOR HIGH nella finalizzazione selezione conti (nessun controllo di ownership su un id conto fornito dal client); un bug Critical scoperto solo dalla review finale di branch — eliminare un conto "auto" con transazioni sincronizzate falliva per un vincolo FK preesistente mai raggiungibile prima di questa feature. Vedi `.superpowers/sdd/progress.md` nel worktree per il ledger dettagliato task-per-task. **Resta il Task 16** (verifica end-to-end manuale contro sandbox GoCardless reale): richiede un umano nel browser, non eseguibile dall'agente.
- **2026-07-15** — Chiuso il Task 16 (verifica manuale end-to-end contro sandbox GoCardless reale, eseguita dall'utente): collegamento "Sandbox Finance", consenso, finalizzazione, saldo/transazioni importati, sync verificati. Piano GoCardless 16/16 completo. Il worktree `gocardless-open-banking` non esisteva più come separato: il codice risultava già su `main` (verificato con `git worktree list`), quindi nessuna decisione di merge/PR necessaria. Scelta la schermata **Spese** come prossimo lavoro di dominio (tra Panoramica, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche), motivata dal fatto che le transazioni GoCardless già sincronizzate arrivano con categoria di fallback "Da categorizzare" e serve una schermata per gestirle. Documentata anche una nota tecnica emersa dalla verifica: nessun bottone di sync manuale in UI, solo trigger automatici (finalize one-shot + cron 12h) — comando `tsx` diretto per forzare un sync di test, con attenzione al rate limit sandbox (~4 chiamate/giorno per endpoint per conto).
- **2026-07-18/19** — Implementata la schermata **Spese** end-to-end (piano `docs/superpowers/plans/2026-07-15-spese-screen.md`, 21/21 task completi), eseguita con `superpowers:subagent-driven-development` su worktree dedicato `spese-screen`, poi mergiata su `main`. Motore di calcolo puro (`lib/calc/expenses.ts`: periodo/KPI/categorie/fisse-variabili/andamento 6 mesi), validazione Zod, 5 route API (`transactions` lista/CRUD, `categories` lettura, `budgets` lettura/upsert), hook TanStack Query, 7 componenti dominio (selettore periodo, KPI cards, categorie con budget editabile inline, grafici donut+barre, slider "Dividi", riga transazione con permessi differenziati auto/manuale, form "+ Aggiungi"), pagina di orchestrazione. Bug/gap trovati e corretti durante l'esecuzione (oltre alle review task-per-task): un bug di integrità dati cross-task scoperto solo dalla review finale di whole-branch (PATCH con solo `amount` non rivalidava un `excludedAmount` già impostato contro il nuovo importo, poteva produrre spesa effettiva negativa e corrompere KPI/categorie/grafici); un IDOR-shaped gap simile a quello di GoCardless, individuato nel Task 7 (categoryId nel body di PATCH transazione non era validato per ownership) e un secondo nel Task 8 (test che non provava davvero il caso cross-utente, pur con codice già corretto). Un bug di rendering (select di categoria/conto mostravano l'id grezzo invece del nome, causa: `SelectValue` di `@base-ui/react` richiede una render-prop esplicita) è stato scoperto solo dal test manuale in browser dell'utente — nessuna review automatica lo aveva individuato, essendo un comportamento runtime di libreria non visibile da un diff statico. Vedi `.superpowers/sdd/progress.md` nel worktree `spese-screen` (rimosso dopo il merge, recuperabile da `git log`) per il ledger dettagliato task-per-task e i dettagli delle review. **Deciso di rimandare** (richiesto dall'utente, fuori scope di questo piano): una sezione Budget dedicata separata (oggi il budget-per-categoria vive dentro Spese) e icone/colori per le categorie — entrambi richiedono una sessione `superpowers:brainstorming` dedicata prima di scrivere codice, non ancora schedulata.
