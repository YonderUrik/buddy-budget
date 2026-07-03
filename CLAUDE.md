# BuddyBudget

App di gestione finanziaria personale. Multi-lingua e multi-valuta: lingua e valuta sono scelte dall'utente in fase di onboarding (default italiano/EUR, non hardcoded). L'italiano resta la lingua di lavoro per ora perché l'i18n non è ancora implementato.

## Regole per Claude

- **Non eseguire mai operazioni git** in questa repo (`status`, `add`, `commit`, `push`, `mv`, ecc., incluse le versioni "dry-run" o di sola lettura): è compito esclusivo dell'utente.
- **Fai domande di approfondimento solo quando la richiesta è ambigua o ha un impatto rilevante** (scelte architetturali, comportamento non specificato, più interpretazioni plausibili). Per richieste chiare o di portata limitata, procedi direttamente senza chiedere conferma: l'obiettivo è non rallentare il lavoro con domande superflue.
- **Mantieni questo file aggiornato.** Ogni volta che viene presa una decisione di progetto, cambiata una scelta tecnica, o completata una fase di lavoro rilevante, aggiungi una voce nella sezione [Log delle decisioni](#log-delle-decisioni) e aggiorna "Stato del progetto" se cambia lo stato generale. L'obiettivo è che una nuova chat possa leggere questo file e avere subito il contesto, senza dover richiedere all'utente di ripetere spiegazioni già date.

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

Fase di **inizializzazione del design system + layout shell**: token, tipografia, componenti UI base e la struttura responsive di navigazione (sidebar collassabile) sono pronti. Le schermate reali dell'app (Panoramica, Conti, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche — vedi `docs/product-vision.md` per la sintesi e `docs/functional-spec.md` per il dettaglio) non sono ancora state implementate.

## Log delle decisioni

Voci in ordine cronologico. Aggiungine una nuova (in cima o in fondo, basta essere coerenti) ogni volta che si prende una decisione degna di nota, invece di lasciare che si perda nella cronologia della chat.

- **2026-07-03** — Definita l'architettura tecnica del livello applicativo (finora assente: solo design system + layout shell erano pronti), documentata in `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`. Decisioni principali: hosting self-hosted su cluster k3s single-VPS (namespace unico `production`, niente staging per ora); Postgres + Drizzle ORM per i dati; autenticazione multi-utente con better-auth (magic link + Google OAuth, email via Resend — unico servizio non self-hosted); API come Next.js Route Handlers consumate con TanStack Query lato client (deviazione consapevole da Server Actions, per familiarità e per lasciare aperta la strada a consumer futuri come un'app mobile); nessuna libreria di stato globale introdotta preventivamente (React Context + TanStack Query bastano, Zustand solo se necessario); Redis con ruolo scoped a rate limiting auth e cache di calcoli derivati costosi; Recharts via componente `Chart` di shadcn/ui per i grafici; osservabilità completa da subito (Prometheus + Loki + Grafana); CI/CD con GitHub Actions → GHCR → deploy su merge a `main`. Il modello dati di dominio e la sequenza di implementazione delle schermate restano da definire in un piano successivo.

- **2026-07-03** — Inizializzato il progetto Next.js (App Router, TypeScript, pnpm) a partire dal mockup `docs/design-reference/mock-up.html`. Scelte fatte: Tailwind CSS + shadcn/ui come stack di styling, dark mode con `next-themes`, scope della fase 1 limitato a design system + style guide (nessuna schermata reale ancora). Documentata anche la visione di prodotto in `docs/product-vision.md`.
- **2026-07-03** — Eseguito e testato interattivamente il mockup (servito via HTTP locale, cliccando ogni bottone/slider/campo di tutte le schermate) perché la sintesi iniziale in `product-vision.md` era incompleta: il mockup ha **9 aree** (Panoramica, Conti, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche), non le 7 elencate inizialmente ("Entrate"/"Budget"/"Risparmi"/"Categorie" non esistono come sezioni a sé, sostituite/ampliate da Cash flow e Pianifica). Prodotto `docs/functional-spec.md` come fonte di verità dettagliata su cosa è realmente funzionante nel mockup (es. simulatori what-if in Pensione/Debiti/Pianifica, editing inline in Conti/Investimenti/Debiti) e cosa è solo scenografia statica (es. tutti i bottoni "+ Aggiungi"/"+ Registra" sono stub tranne "+ Aggiungi conto" in Conti; "Vedi tutti" in Panoramica non fa nulla; il filtro periodo in Spese non filtra la lista transazioni). `product-vision.md` aggiornato con l'elenco corretto delle 9 aree e rimando al nuovo documento.
- **2026-07-03** — Implementata la sidebar collassabile e responsive (`components/layout/`). Comportamento: mobile (<768px) → drawer + topbar hamburger; tablet (768–1023px) → icon-only automatica; desktop (≥1024px) → espansa, collassabile manualmente con stato persistito in localStorage. Introdotta architettura a 3 layer (`ui/` → `domain/` + `layout/` → `app/`) e aggiunte a `CLAUDE.md` le regole di riusabilità, manutenibilità e organizzazione a layer. `stat-card.tsx` spostato in `components/domain/`. Aggiornata `docs/functional-spec.md` per riflettere il comportamento responsive della sidebar.
- **2026-07-03** — Revisionato `docs/functional-spec.md`: ogni voce "Cosa il mockup NON implementa" ora è seguita da una decisione esplicita per il prodotto reale (implementare con quale comportamento, o escludere consapevolmente e perché), invece di lasciare che l'assenza di una funzionalità nel mockup fosse letta come un limite anche per il prodotto. Decisioni principali: tutti gli stub "+ Aggiungi"/"+ Registra" (Spese, Investimenti, Debiti) vanno implementati end-to-end; il selettore periodo in Spese e il meccanismo "Dividi" devono ricalcolare in modo coerente ovunque (un solo motore di calcolo, non dataset scollegati come nel mockup); i conti/transazioni "Auto" restano di sola lettura salvo un'azione esplicita "Scollega" (niente editing arbitrario come nel mockup); l'immobile (oggi solo in Debiti → "Il quadro completo") va reso un'entità di prodotto gestibile, con patrimonio netto mostrato in entrambe le varianti (con/senza immobile); gli scenari in Pianifica devono poter essere personalizzati e salvati con nome; niente simulazioni probabilistiche/Monte Carlo né topbar/notifiche globali (fuori scope, non richieste dal target di prodotto); ricerca globale rimandata a dopo l'MVP. Restano domande aperte genuine (non decise qui, da chiarire con l'utente): multi-utente/multi-piano, integrazione bancaria reale (Open Banking) e integrazione prezzi di mercato live — tutte segnalate esplicitamente nel documento come fuori scope per questa fase, non come decisioni prese.
- **2026-07-03** — Capovolta la decisione precedente su lingua/valuta fisse (`docs/functional-spec.md`, voce "Valuta fissa e lingua fissa" nelle limitazioni trasversali, che dava per confermato italiano/EUR fissi): il prodotto reale deve supportare **multi-lingua e multi-valuta**, non solo italiano/EUR come nel mockup. Lingua e valuta diventano preferenze **per-utente scelte in fase di onboarding** (non un selettore sempre visibile in topbar), con italiano/EUR come default. Restano aperte per un piano successivo: quali lingue/valute supportare al lancio, la libreria di i18n da adottare (impatta anche le stringhe già scritte in italiano nei componenti esistenti, che andranno estratte in chiavi di traduzione) e la strategia di formattazione numeri/date/valuta in base alla preferenza scelta.
- **2026-07-03** — Aggiunta regola su quando fare domande di approfondimento: solo per richieste ambigue o ad alto impatto, non per ogni richiesta, per evitare di rallentare il lavoro.
