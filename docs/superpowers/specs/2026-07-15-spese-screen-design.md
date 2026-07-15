# Design: schermata Spese

**Data**: 2026-07-15
**Stato**: approvato in brainstorming, in attesa di piano di implementazione

## Contesto

Prima schermata di dominio implementata dopo il completamento dell'integrazione GoCardless (Task 1-16 completi, vedi `CLAUDE.md`). Le transazioni sincronizzate da GoCardless arrivano con categoria di fallback "Da categorizzare" — Spese è il punto dove vanno gestite e ricategorizzate. Lo scope è definito in dettaglio in `docs/functional-spec.md` (sezione "3. Spese"), che documenta sia cosa fa il mockup sia le decisioni prese per il prodotto reale rispetto a ogni gap del mockup.

Decisione di scope (confermata con l'utente): implementare tutto in un unico giro — KPI, grafici, categorie con budget, lista transazioni completa (editing/dividi/elimina), form di aggiunta, budget-setting — non a fasi separate.

## Stato esistente riusato

Verificato nel codice prima di progettare, per non duplicare:

- **`transactions`** (`lib/db/schema/transactions.ts`): già esiste. Colonne rilevanti: `amount`, `date`, `description`, `categoryId` (FK, sempre valorizzata), `accountId` (FK), `source` (`manuale`/`auto`), `externalId` (univoco per idempotenza sync), **`excludedAmount`** (già il campo "Dividi" — persistito, non stato UI locale come nel mockup). Validazione esistente `isValidExcludedAmount()`.
- **`categories`** (`lib/db/schema/categories.ts`): già esiste, per-utente. 8 categorie fisse + fallback "Da categorizzare" già seminate in `databaseHooks.user.create.after` (`lib/auth/index.ts`) e `lib/db/seed.ts`. `type`: `fissa`/`variabile` (serve per il donut "Fisse vs variabili").
- **`budgets`** (`lib/db/schema/budgets.ts`): già esiste, mai consumata da UI/API. `monthlyAmount` per `(userId, categoryId)`, budget solo mensile.
- **Non esiste**: nessun motore di calcolo periodo (settimana/mese/3 mesi/anno) in tutto il repo. Va progettato da zero.
- **Pattern di riferimento**: schermata Conti (`app/(app)/conti/`, `components/domain/accounts/`, `lib/queries/accounts.ts`, `app/api/accounts/`) — stesso stack Route Handlers + TanStack Query + Zod + ownership check, stesso pattern `*-kpi.tsx`/`*-kpi.utils.ts` per separare UI e calcolo.

## Architettura

### Motore di calcolo periodo — `lib/calc/expenses.ts`

Modulo puro, nessun side-effect, testabile in isolamento:

- `getPeriodRange(period, referenceDate)` → `{from, to}` per Settimana/Mese/3 mesi/Anno
- `getPreviousPeriodRange(period, referenceDate)` → finestra immediatamente precedente, stessa lunghezza (serve per "Media giornaliera vs periodo precedente")
- `computeKpis(transactions, budgets, period)` → Speso nel periodo, Budget rimanente, Media giornaliera + confronto col periodo precedente
- `computeCategoryBreakdown(transactions, categories, period)` → importo per ciascuna delle 8 categorie
- `computeFixedVsVariable(transactions, categories, period)` → dati per il donut
- `compute6MonthTrend(transactions)` → dati per il grafico a barre ultimi 6 mesi (indipendente dal periodo selezionato)

Tutte le funzioni operano su un `amount` "effettivo" = `amount - excludedAmount` per transazione: questo garantisce che "Dividi" sia automaticamente coerente ovunque (KPI, categorie, grafici), risolvendo il disallineamento presente nel mockup (nel mockup KPI e slider "Dividi" erano due sistemi scollegati).

### Perché calcolo client-side, non aggregazione SQL

`docs/functional-spec.md` dice esplicitamente che paginazione/filtri server-side servono solo "quando il volume reale supera la manciata di righe demo" — non è il caso ora. Un singolo `GET /api/transactions?from&to` restituisce una finestra di 13 mesi (copre il periodo "Anno" + il confronto col periodo precedente + l'andamento 6 mesi), e tutto il resto è calcolo JS puro riusabile. Migrazione futura ad aggregazione SQL server-side resta un'ottimizzazione isolata: cambierebbe solo l'endpoint, non le firme delle funzioni di calcolo.

### Budget mensile e periodi non mensili

Il budget in DB è solo mensile (`monthlyAmount`). Per periodi diversi da "Mese", il budget del periodo è **proporzionale**: es. Settimana ≈ `monthlyAmount / 30 * 7`, 3 mesi = `monthlyAmount * 3`, Anno = `monthlyAmount * 12`. Coerente con l'esempio riportato nello spec funzionale ("Settimana: € 640 su € 740").

### Convenzione segno importo e filtro entrate

`transactions` è condivisa con il futuro sync generale del conto: GoCardless importa **tutte** le transazioni bancarie, non solo le uscite (es. anche stipendi, bonifici in entrata), con convenzione segno standard (negativo = uscita, positivo = entrata). La schermata Spese deve mostrare/calcolare **solo le uscite**: ogni query e ogni funzione del motore di calcolo filtra su `amount < 0`. Le entrate (importo positivo) restano nella stessa tabella ma invisibili in questa schermata — serviranno alla futura schermata Cash flow. Il form di inserimento manuale in Spese offre solo le 8 categorie di spesa: l'utente digita un importo positivo ("Importo €"), che viene negato prima di essere salvato (coerente con la convenzione).

### Gestione categoria su transazioni "Auto"

Lo spec funzionale contiene un'apparente contraddizione: dice che le transazioni "Auto" non sono modificabili (solo "Dividi"), ma anche che la categoria deve essere sempre correggibile — e le transazioni GoCardless arrivano proprio con categoria fallback "Da categorizzare" da sistemare. Risolto con l'utente: su transazioni Auto, **solo la categoria è editabile** (oltre a "Dividi"); descrizione/importo/data restano bloccati perché falserebbero il dato bancario sorgente.

### API (`app/api/transactions/`, `app/api/budgets/`)

Stesso pattern di `app/api/accounts/`: `auth.api.getSession({ headers })` per l'auth, Zod (`lib/validation/*.ts`) con `safeParse`, helper di ownership check prima di ogni mutazione, Drizzle diretto senza repository layer.

- `GET /api/transactions?from=&to=` — lista nella finestra richiesta
- `POST /api/transactions` — crea transazione manuale
- `PATCH /api/transactions/[id]` — allowlist campi per `source`: `manuale` → descrizione/importo/data/categoria/`excludedAmount`; `auto` → solo categoria/`excludedAmount`. Validazione `excludedAmount` riusa `isValidExcludedAmount()` esistente.
- `DELETE /api/transactions/[id]` — 400 se `source = auto`
- `GET /api/budgets` — lista budget per utente
- `PUT /api/budgets/[categoryId]` — upsert `monthlyAmount`

### Conto associato a una spesa manuale

`transactions.accountId` è una FK obbligatoria, ma il form "+ Aggiungi" dello spec non prevede un selettore di conto. Deciso con l'utente: il form aggiunge un campo **"Conto"** (select), popolato solo con i conti **manuali** dell'utente (`source = "manuale"`) — i conti "auto" (collegati via GoCardless) sono esclusi, coerente con la logica già esistente per cui un conto auto riflette solo dati sincronizzati dalla banca e non va alterato da inserimenti manuali locali.

## Componenti (`components/domain/expenses/`, barrel `index.ts`)

- `expenses-period-selector.tsx` — Settimana/Mese/3 mesi/Anno
- `expenses-kpi-cards.tsx` + `expenses-kpi-cards.utils.ts` — Speso, Budget rimanente, Media giornaliera (UI e calcolo separati, come `accounts-kpi.tsx`)
- `category-breakdown.tsx` — le 8 categorie con importo e budget mensile editabile inline (click → input, `PUT /api/budgets/[categoryId]`)
- `expenses-charts.tsx` — donut "Fisse vs variabili" + barre "Andamento ultimi 6 mesi", via componente `Chart` di shadcn/ui (Recharts, già nello stack)
- `transaction-row.tsx` — rendering condizionale per `source`: auto → categoria editabile + "Dividi", nessun ✕; manuale → tutto editabile + ✕
- `split-slider.tsx` — UI "Dividi", scrive `excludedAmount` via `PATCH`
- `add-transaction-form.tsx` — form di inserimento in fondo pagina

## Pagina

`app/(app)/spese/page.tsx` — client component, nessuna logica di business (coerente con regola CLAUDE.md sulle route). Orchestra hook TanStack Query (`lib/queries/expenses.ts`, `lib/queries/budgets.ts`) e i componenti sopra. Stato del periodo selezionato: `useState` locale nella pagina (non serve Context, nessun altro componente al di fuori di questa schermata ne ha bisogno).

## Error handling

Stesso pattern di Conti: stati loading/error/empty gestiti inline nella pagina, mutazioni con feedback di errore coerente con quanto già implementato lì (da verificare il meccanismo esatto — toast o inline — in fase di piano, per restare coerenti). Validazione Zod lato API rifiuta importi negativi, categoria inesistente, date malformate (400).

## Testing

TDD come da convenzione di progetto:

- **Motore di calcolo** (`lib/calc/expenses.ts`): unit test puri — boundary dei periodi, proporzione budget, `excludedAmount`, confronto col periodo precedente. Il pezzo più critico e più facile da isolare.
- **Route API**: validazione, ownership check, allowlist campi per `source`.
- Nessun test E2E automatizzato per la UI (fuori scope, coerente col resto del progetto — verifica manuale in browser a fine implementazione).

## Fuori scope (esplicito)

- Aggregazione SQL server-side per i calcoli (rimandata a quando il volume dati lo richiede)
- Categorizzazione automatica avanzata delle transazioni Auto oltre al fallback esistente (fuori scope qui, eventualmente una funzione dedicata futura)
- Paginazione/ricerca/filtro categoria nella lista transazioni (per lo stesso motivo dello spec funzionale: non necessario col volume dati attuale)
