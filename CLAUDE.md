# BuddyBudget

App di gestione finanziaria personale. Interfaccia in italiano.

## Regole per Claude

- **Non eseguire mai operazioni git** in questa repo (`status`, `add`, `commit`, `push`, `mv`, ecc., incluse le versioni "dry-run" o di sola lettura): è compito esclusivo dell'utente.
- **Mantieni questo file aggiornato.** Ogni volta che viene presa una decisione di progetto, cambiata una scelta tecnica, o completata una fase di lavoro rilevante, aggiungi una voce nella sezione [Log delle decisioni](#log-delle-decisioni) e aggiorna "Stato del progetto" se cambia lo stato generale. L'obiettivo è che una nuova chat possa leggere questo file e avere subito il contesto, senza dover richiedere all'utente di ripetere spiegazioni già date.

## Stack

- Next.js (App Router) + TypeScript
- pnpm come package manager
- Tailwind CSS v4 + shadcn/ui (stile `base-nova`, componenti su `@base-ui/react`, icone `lucide-react`)
- `next-themes` per il tema chiaro/scuro

## Comandi

```
pnpm dev      # server di sviluppo
pnpm build    # build di produzione
pnpm lint     # ESLint
```

## Struttura

```
app/                    route App Router
  globals.css           design token (CSS variables) e theme Tailwind
  style-guide/           pagina di riferimento del design system
components/
  ui/                    primitive shadcn (button, card, badge, input, ...)
  theme-provider.tsx     wrapper next-themes
  theme-toggle.tsx       toggle chiaro/scuro
  stat-card.tsx          card per importi in evidenza (positivo/negativo)
lib/
  utils.ts               helper `cn`
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
- Tutte le stringhe visibili all'utente sono in italiano.

## Stato del progetto

Questa è la fase di **inizializzazione del design system**: token, tipografia e componenti UI base sono pronti (`/style-guide`), ma le schermate reali dell'app (Panoramica, Conti, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche — vedi `docs/product-vision.md` per la sintesi e `docs/functional-spec.md` per il dettaglio) non sono ancora state implementate.

## Log delle decisioni

Voci in ordine cronologico. Aggiungine una nuova (in cima o in fondo, basta essere coerenti) ogni volta che si prende una decisione degna di nota, invece di lasciare che si perda nella cronologia della chat.

- **2026-07-03** — Inizializzato il progetto Next.js (App Router, TypeScript, pnpm) a partire dal mockup `docs/design-reference/mock-up.html`. Scelte fatte: Tailwind CSS + shadcn/ui come stack di styling, dark mode con `next-themes`, scope della fase 1 limitato a design system + style guide (nessuna schermata reale ancora). Documentata anche la visione di prodotto in `docs/product-vision.md`.
- **2026-07-03** — Eseguito e testato interattivamente il mockup (servito via HTTP locale, cliccando ogni bottone/slider/campo di tutte le schermate) perché la sintesi iniziale in `product-vision.md` era incompleta: il mockup ha **9 aree** (Panoramica, Conti, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche), non le 7 elencate inizialmente ("Entrate"/"Budget"/"Risparmi"/"Categorie" non esistono come sezioni a sé, sostituite/ampliate da Cash flow e Pianifica). Prodotto `docs/functional-spec.md` come fonte di verità dettagliata su cosa è realmente funzionante nel mockup (es. simulatori what-if in Pensione/Debiti/Pianifica, editing inline in Conti/Investimenti/Debiti) e cosa è solo scenografia statica (es. tutti i bottoni "+ Aggiungi"/"+ Registra" sono stub tranne "+ Aggiungi conto" in Conti; "Vedi tutti" in Panoramica non fa nulla; il filtro periodo in Spese non filtra la lista transazioni). `product-vision.md` aggiornato con l'elenco corretto delle 9 aree e rimando al nuovo documento.
