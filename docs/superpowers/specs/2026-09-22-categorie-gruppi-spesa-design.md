# Gruppi di spesa per le categorie (Dovute / Volute / Te futuro / Saltuarie) — design

Data: 2026-09-22 · Stato: approvato in brainstorming, in attesa di revisione spec

## Obiettivo

Sostituire la classificazione a due livelli delle categorie di spesa (`fissa` / `variabile`) con quattro
**gruppi di spesa**, ispirati a un metodo di budgeting per "destinazione" del denaro:

| Chiave      | Etichetta UI | Colore | Descrizione (mostrata in `/categorie`) |
|-------------|--------------|--------|-----------------------------------------|
| `dovuta`    | Dovute       | rosso  | Spese necessarie per vivere e mantenere lo stile di vita base: senza queste avresti problemi pratici o legali. |
| `voluta`    | Volute       | giallo | Migliorano la qualità della vita ma potresti farne a meno: desideri, svago, comfort. |
| `futuro`    | Te futuro    | verde  | Risparmio e investimenti trattati come spesa prioritaria, non come ciò che avanza. |
| `saltuaria` | Saltuarie    | blu    | Spese necessarie ma non mensili: tasse annuali, manutenzioni, regali. |

Le entrate restano un tipo a sé (`entrata`), invariato.

## Decisioni prese in brainstorming

1. **"Te futuro" conta come spesa normale**: entra in "Speso nel periodo" e in tutti i totali di uscita come
   oggi. Il gruppo serve a raggruppare/colorare, non cambia nessun totale.
2. **"Saltuarie" è solo un raggruppamento**: nessuna logica extra (niente budget annuale spalmato né
   accantonamento mensile — eventualmente nella futura sezione Budget).
3. **Migrazione = reset delle categorie**: le categorie vengono riportate alla nuova lista di default; le
   personalizzazioni vanno perse (accettato dall'utente).
4. **Etichette UI brevi e colloquiali**: Dovute · Volute · Te futuro · Saltuarie.
5. **Modello dati: approccio A** — si sostituiscono i valori dell'enum `category_type` invece di aggiungere
   una colonna `group` separata (la direzione entrata/uscita resta derivata da `type === "entrata"`).

## Fuori scope (consapevolmente)

- Budget per gruppo (stile 50/30/20) → con la futura sezione **Budget** separata, già in lista.
- Filtro per gruppo nella schermata Transazioni.
- Accantonamento mensile / budget annuale per le Saltuarie.
- Preservare categorie personalizzate durante la migrazione (scelto il reset).

## 1. Dati

### Enum

`category_type`: `dovuta | voluta | futuro | saltuaria | entrata`.

### Modulo unico dei gruppi — `lib/categories/groups.ts`

Unica fonte di verità, importata da tutti i layer (non dipende da React né dal DB):

- `CATEGORY_TYPES` (tuple `as const`) e `type CategoryType`.
- `EXPENSE_GROUP_KEYS` ordinati (`dovuta`, `voluta`, `futuro`, `saltuaria`) e `type ExpenseGroup`.
- `EXPENSE_GROUPS: Record<ExpenseGroup, { label; shortDescription; description; colorVar }>` —
  `colorVar` è il nome del token CSS (`--group-dovuta`, …), mai un hex.
- `CATEGORY_TYPE_LABELS: Record<CategoryType, string>` (le 4 etichette + "Entrata").
- `isExpenseGroup(type): type is ExpenseGroup`.
- `DEFAULT_NEW_CATEGORY_TYPE = "voluta"`.

Tutti i punti che oggi ripetono l'unione letterale `"fissa" | "variabile" | "entrata"` la sostituiscono con
`CategoryType` / `ExpenseGroup`: dimenticarne uno deve diventare un errore di `tsc`, non un bug silenzioso.
Lo schema Drizzle usa `pgEnum("category_type", CATEGORY_TYPES)`; lo Zod usa `z.enum(CATEGORY_TYPES)`.

### Categoria fallback "Da categorizzare"

Resta `isFallback: true`. Il suo `type` nel DB diventa `voluta` (serve un valore non-null, è arbitrario):
**nessuna statistica deve classificarla per `type`** — tutte le aggregazioni la instradano per `isFallback`
in un bucket dedicato "Da categorizzare" (oggi invece finiva silenziosamente tra le variabili).

### Nuove categorie di default (`DEFAULT_CATEGORIES`)

Icone tutte già presenti in `CATEGORY_ICONS`.

| Gruppo | Nome | Icona |
|---|---|---|
| Dovute | Affitto & Mutuo | home |
| Dovute | Bollette & Utenze | zap |
| Dovute | Internet & Telefono | wifi |
| Dovute | Spesa alimentare | shopping-cart |
| Dovute | Trasporti & Carburante | fuel |
| Dovute | Salute & Farmaci | pill |
| Dovute | Assicurazioni | shield |
| Dovute | Rate & Finanziamenti | credit-card |
| Dovute | Figli & Istruzione | graduation-cap |
| Dovute | Animali domestici | paw-print |
| Volute | Ristoranti & Bar | utensils |
| Volute | Abbonamenti & Streaming | tv |
| Volute | Svago & Hobby | gamepad-2 |
| Volute | Sport & Benessere | dumbbell |
| Volute | Abbigliamento | shirt |
| Volute | Shopping & Tecnologia | laptop |
| Volute | Cura personale | scissors |
| Volute | Viaggi & Vacanze | plane |
| Te futuro | Fondo emergenza | wallet |
| Te futuro | Risparmio per obiettivi | piggy-bank |
| Te futuro | Investimenti | coins |
| Te futuro | Pensione integrativa | landmark |
| Saltuarie | Tasse & Bolli | receipt |
| Saltuarie | Manutenzione auto | wrench |
| Saltuarie | Casa & Arredamento | sofa |
| Saltuarie | Regali & Ricorrenze | gift |
| Saltuarie | Imprevisti | alert-triangle |
| — (fallback) | Da categorizzare | help-circle (red, `isFallback`) |
| Entrate | Stipendio | banknote |
| Entrate | Freelance | briefcase |
| Entrate | Dividendi e interessi | trending-up |
| Entrate | Rimborsi | calculator |
| Entrate | Altre entrate | package |

Lista estesa su richiesta dell'utente (2026-09-22) pensando alle spese di una persona media, senza frammentare.

I colori delle singole categorie restano dalla palette `SWATCH_COLORS` (assegnati nella lista; l'utente può
usare "Distribuisci colori"). I colori dei **gruppi** sono token separati (vedi §2).

Consumatori di `DEFAULT_CATEGORIES` da aggiornare automaticamente (usano la lista, nessuna modifica logica):
`lib/auth/index.ts` (seed nuovo utente), `lib/db/seed.ts`. `lib/db/backfill-category-appearance.ts` è uno
script one-shot storico già eseguito: resta, ma il reset lo rende obsoleto (annotarlo nel suo JSDoc).

### Migrazione DB

1. Script di migrazione enum versionato nel repo e idempotente, `lib/db/migrate-category-groups.ts`
   (`pnpm db:migrate-category-groups`). Non una migration Drizzle: il DB di questo progetto è gestito con
   `db:push` e il journal Drizzle contiene solo la baseline `0000`, quindi `db:migrate` non è affidabile.
   Lo script legge i valori correnti da `pg_enum` ed esegue solo ciò che manca:
   `ALTER TYPE category_type RENAME VALUE 'fissa' TO 'dovuta'`,
   `ALTER TYPE category_type RENAME VALUE 'variabile' TO 'voluta'`,
   `ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'futuro' BEFORE 'entrata'`,
   `ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'saltuaria' BEFORE 'entrata'`
   (ordine finale identico a `CATEGORY_TYPES` → `db:push` non propone modifiche su questo enum).
   `ADD VALUE` gira fuori da transazioni; il reset dati è uno step separato.
   **Attenzione DB condiviso**: dopo la rinomina, il codice di `main` non ancora mergiato (che scrive
   `"fissa"`/`"variabile"`) è incompatibile col DB fino al merge — finestra da tenere breve.
2. Script one-shot `lib/db/reset-categories.ts` (`pnpm db:reset-categories`), idempotente, una transazione
   **per utente**:
   - assicura che esista la categoria fallback (riusando la logica di `lib/categorization/fallback.ts`);
   - per ogni default: se esiste una categoria con quel nome **o con un nome vecchio mappato**
     (`LEGACY_CATEGORY_NAMES` in `lib/db/schema/categories.ts`, ricostruita da git log su **tutte** le liste
     di default storicamente sedute, non solo l'ultima prima di questa: default pre-icone/colori
     (2026-07-03→2026-07-21) "Affitto"→"Affitto & Mutuo", "Bollette & casa"→"Bollette & Utenze",
     "Ristoranti"→"Ristoranti & Bar", "Svago"→"Svago & Hobby", "Trasporti"→"Trasporti & Carburante";
     default 2026-07-26 "Assicurazioni & Tasse"→"Assicurazioni", "Risparmi & Investimenti"→"Investimenti",
     "Trasporti & Auto"→"Trasporti & Carburante", "Salute & Cura"→"Salute & Farmaci",
     "Svago & Hobbies"→"Svago & Hobby", "Abbonamenti"→"Abbonamenti & Streaming",
     "Shopping"→"Shopping & Tecnologia", "Viaggi"→"Viaggi & Vacanze", "Regali"→"Regali & Ricorrenze";
     prima versione gruppi di spesa (2026-09-22, pre-estensione a 33) "Manutenzione auto/casa"→"Manutenzione auto",
     "Sport & Palestra"→"Sport & Benessere". **"Altro"** (default storico fino al 2026-07-21) resta
     deliberatamente non mappato: nessun equivalente naturale nella nuova lista, quindi il reset lo elimina
     come categoria personalizzata (le sue transazioni finiscono su "Da categorizzare")
     la aggiorna (nome, tipo, icona, colore) preservandone id → transazioni, regole e budget restano collegati;
     altrimenti la crea;
   - ogni altra categoria non-fallback non presente nella nuova lista (incluse le personalizzate):
     transazioni riassegnate alla fallback, budget eliminati, regole di categorizzazione eliminate (la FK ha
     già `onDelete: cascade`, ma vanno eliminate esplicitamente prima per chiarezza/log), categoria eliminata;
   - log per utente: categorie aggiornate / create / eliminate, transazioni riassegnate, più i nomi coinvolti
     (rinominate "da → a", eliminate).
   - Flag `--dry-run` che stampa lo stesso riepilogo (nomi inclusi) senza scrivere.
   Lo script va eseguito dall'utente (DB condiviso), dopo la migration.

## 2. Statistiche e UI

### Token colore

Nuovi token in `app/globals.css`, sia in `:root` sia in `.dark`, esposti in `@theme inline`:
`--group-dovuta` (rosso), `--group-voluta` (giallo), `--group-futuro` (verde), `--group-saltuaria` (blu),
`--group-uncategorized` (grigio neutro). Il giallo in tema chiaro va scelto con contrasto sufficiente come
fill di grafico (non come testo).

### 2a. Transazioni → card "Per categoria" (`CategoryBreakdownDonut`)

- `computeFixedVsVariable` / `FixedVsVariable` sostituiti da `computeGroupTotals` / `GroupTotals`
  (`Record<ExpenseGroup, number> & { daCategorizzare: number }`), in `lib/calc/expenses.ts`.
- `CategoryAmount.type: "fissa" | "variabile"` diventa `group: ExpenseGroup | "daCategorizzare"`
  (la fallback → `"daCategorizzare"`, riconosciuta via `isFallback`).
- Anello interno: una fetta per gruppo, nell'ordine di `EXPENSE_GROUP_KEYS`, più "Da categorizzare" solo se > 0.
- Anello esterno: `sortCategoryAmounts` ordina per gruppo (stesso ordine, "Da categorizzare" in coda) e poi per
  importo decrescente — l'allineamento angolare con l'anello interno resta garantito.
- Legenda: pallino col colore del gruppo accanto al nome di ogni riga. Ordinamenti della legenda invariati.
- JSDoc del componente aggiornato ("layer interno gruppo di spesa").

### 2b. Cash flow → "Dove va ogni euro" (`computeWhereItGoes` / `WhereItGoesBreakdown`)

Voci, in quest'ordine: **Dovute, Volute, Te futuro, Saltuarie, Non classificato, Avanzo**.

- "Non classificato" = spese su categoria fallback **+** spese su categoria sconosciuta (oggi solo la seconda).
- "Risparmio" (entrate − tutte le uscite) rinominato **"Avanzo"**, chiave `avanzo`: con "Te futuro" come
  spesa, chiamarlo "Risparmio" sarebbe ambiguo. Il calcolo non cambia.
- Il componente continua a non assumere il numero di voci; aggiunge un pallino col colore del gruppo per le
  quattro voci di gruppo.

### 2c. `/categorie`

- Lista divisa in sezioni: Dovute, Volute, Te futuro, Saltuarie, poi Entrate. Ogni sezione ha intestazione
  con pallino colore gruppo, etichetta e `shortDescription`. La fallback non appartiene a nessun gruppo: sta
  in una riga a sé dopo le Saltuarie e prima delle Entrate, sotto l'intestazione "Da categorizzare".
- La logica di raggruppamento è una funzione pura (`groupCategoriesByType` in `lib/categories/groups.ts` o
  accanto), la pagina resta solo orchestrazione.
- `AddCategoryForm` e `CategoryRow`: `Select` del tipo con 5 opzioni da `CATEGORY_TYPE_LABELS`, default
  `DEFAULT_NEW_CATEGORY_TYPE`. Nessuna `TYPE_LABELS` locale duplicata.

### 2d. Solo cambio di tipo (nessun effetto visibile)

`lib/validation/categories.ts`, `lib/categorization/match-rule.ts` (`isDirectionCompatible`, `RuleCandidate`),
`lib/categorization/suggest.ts`, `lib/categorization/fallback.ts`, `app/api/transactions/route.ts` e
`[id]/route.ts` (segno derivato da `type === "entrata"`, invariato), `app/api/categories/**`,
`app/api/categorization-rules/**`, `/categorizza`, `category-breakdown-donut.utils.ts` (`TYPE_ORDER`).

### 2e. Invariati

Trend 6 mesi (per categoria), KPI Uscite/Entrate, Panoramica, budget per categoria, sync GoCardless.

## 3. Test

- `lib/categories/groups.test.ts`: ordine gruppi, etichette complete per ogni `CategoryType`,
  `groupCategoriesByType` (fallback separata, entrate in fondo, gruppi vuoti).
- `lib/calc/expenses.test.ts`: `computeGroupTotals` (4 gruppi + fallback in `daCategorizzare`, entrate escluse),
  `computeCategoryBreakdown` con `group`.
- `category-breakdown-donut.utils.test.ts`: `sortCategoryAmounts` con 4 gruppi + fallback in coda.
- `lib/calc/cashflow.test.ts`: `computeWhereItGoes` con le 6 voci, fallback in "Non classificato", `avanzo`.
- `lib/db/schema/categories.test.ts`: ogni default ha icona in `CATEGORY_ICONS`, tipo valido, nomi unici,
  esattamente una fallback, ogni gruppo ha almeno una categoria.
- Script di reset: la decisione (cosa aggiornare/creare/eliminare) è una funzione pura `planCategoryReset`
  testata con vitest, stesso pattern di `buildRulesFromHistory` in `backfill-categorization-rules.ts` —
  rinomina via `LEGACY_NAME_MAP` preserva l'id; nome esatto vince sul nome legacy; personalizzata in
  `deletions`; fallback mai toccata; secondo piano sullo stato già resettato = nessuna azione. Il wrapper DB
  (`resetUserCategories`) applica il piano in transazione.
- Tutti i fixture di test che usano `"fissa"`/`"variabile"` (≈20 file sotto `app/api/**` e `lib/**`) aggiornati.
- Verifica finale: `tsc --noEmit` pulito, suite vitest (esclusi i 3 fallimenti noti di `scheduler.test.ts`),
  `pnpm lint` senza nuovi errori, `grep` di `"fissa"`/`"variabile"` nel codice (esclusi `docs/` e la
  migration) = 0 risultati.

## 4. Documentazione

- `docs/functional-spec.md`: sezioni Spese/Transazioni e Cash flow aggiornate (gruppi, "Avanzo").
- `CLAUDE.md`: voce di log + "Stato del progetto".

## Verifica manuale utente (dopo l'implementazione)

Eseguire migration + `db:reset-categories --dry-run` poi reale; controllare `/categorie` divisa per sezioni,
torta con 4 colori di gruppo allineati all'anello esterno, "Dove va ogni euro" con 6 voci, creazione di una
nuova categoria per ciascun gruppo, nuovo utente con i nuovi default.
