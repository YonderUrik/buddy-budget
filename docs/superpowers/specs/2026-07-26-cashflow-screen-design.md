# Cash flow — design

Data: 2026-07-26

## Scopo

Nuova schermata Cash flow (finora non implementata): confronto entrate vs uscite, non solo visualizzazione spese. Richiede prima colmare un gap esistente — non esiste ancora un modo di inserire entrate (stipendio, freelance, dividendi) nel prodotto.

## 1. Modello dati

- `categoryTypeEnum` esteso da `["fissa", "variabile"]` a `["fissa", "variabile", "entrata"]`. Nessuna migrazione distruttiva, solo nuovo valore enum.
- `transactions`: schema invariato. Il segno di `amount` codifica già la direzione (negativo = uscita, positivo = entrata) — nessuna colonna nuova.
- `budgets`: invariato. Le categorie `entrata` non compariranno mai nei calcoli budget/donut/trend di Spese perché quei calcoli filtrano già `isExpense` (`amount < 0`).
- Nessuna colonna `isTransfer`. I trasferimenti interni tra conti propri (giroconti) restano un gap noto e rimandato (vedi "Fuori scope").

### API

- **GET `/api/transactions`**: oggi filtra hardcoded `amount < 0` (solo uscite). Estesa con parametro opzionale `type` (`uscita` default per retrocompatibilità / `entrata` / `tutte`).
- **POST `/api/transactions`**: oggi nega sempre l'importo inserito (assume spesa). Il segno da salvare va derivato lato server dal `type` della categoria scelta (`entrata` → importo positivo così com'è, `fissa`/`variabile` → importo negato), non da un campo separato manipolabile dal client.

## 2. Pagina Spese → Transazioni

- Rebrand: voce sidebar "Spese" → "Transazioni", titolo pagina idem. Route resta `/spese` (rinominare la route non porta beneficio, solo rischio).
- Nuovo toggle tipo lista: **Tutte / Uscite / Entrate**, default **Uscite** (comportamento attuale invariato di default). Il toggle filtra solo la lista transazioni.
- KPI cards, donut categorie ("Fisse vs variabili" + budget), trend 6 mesi restano **sempre uscite-only**, indipendenti dal toggle — restano "analisi spesa" concettualmente, non cambiano contenuto quando il toggle è su Entrate. Evita di duplicare lì il lavoro di analisi che spetta a Cash flow.
- `AddTransactionForm`: nuovo toggle **Spesa/Entrata**. Determina quale sottoinsieme di categorie è selezionabile (fissa+variabile vs entrata). Il segno salvato è derivato server-side dal tipo della categoria scelta (vedi sopra), non da questo toggle direttamente — il toggle esiste solo per filtrare la select categorie lato client.
- Filtro categoria esistente (`ExpensesFilterBar`) invariato, ma la select categorie in "Aggiungi" esclude `entrata` a meno che il toggle form sia su Entrata.
- `/categorie`: `add-category-form.tsx` e `category-row.tsx` guadagnano l'opzione "Entrata" nel select tipo (oggi solo Fissa/Variabile).

## 3. Motore di calcolo — `lib/calc/cashflow.ts` (puro, testato)

- `isIncome(t)`: `amount > 0` — simmetrico a `isExpense` in `lib/calc/expenses.ts`.
- `CashflowPeriod = "3mesi" | "6mesi" | "12mesi" | "24mesi"`, con range/shift/nav costruiti sullo stesso pattern di `getPeriodRange`/`shiftReferenceDate` di Spese (periodo + navigazione avanti/indietro, non solo "ultimi N mesi da oggi").
- `computeCashflowKpis(transactions, range)`: Entrate medie/mese, Uscite medie/mese (somma piena delle uscite ÷ mesi nel range, nessuna esclusione trasferimenti — debito noto), Flusso netto (entrate − uscite), Tasso di risparmio (`flussoNetto / entrate`, null-safe se entrate = 0).
- `computeMonthlySeries(transactions, range)`: array mese-per-mese `{ mese, entrate, uscite }` per il grafico a barre affiancate.
- `computeIncomeSources(transactions, categories, range)`: somma per categoria di tipo `entrata` nel range, ordinata decrescente, con quota % sul totale entrate — stessa forma logica di `computeCategoryBreakdown` ma per entrate.
- `computeWhereItGoes(transactions, categories, referenceDate)`: mese corrente, 3 voci — Spese fisse, Spese variabili, Risparmio (= entrate − spese fisse − spese variabili del mese; può risultare negativo se si spende più di quanto entra, mostrato così com'è, nessun floor a zero). Investimenti (PAC) omesso: la schermata Investimenti non esiste ancora nel progetto.
- `computeAccumulatedSavings(transactions, range)`: somma cumulata mese-su-mese del flusso netto lungo la finestra selezionata, per il grafico "Risparmio accumulato" + totale.

Tutte le funzioni sono pure e testate con vitest (stesso stile di `expenses.test.ts`), incluse le combinazioni: entrate = 0, mese senza transazioni, risparmio negativo.

Nessuna nuova route API dedicata: la pagina fetcha transazioni (`type=tutte`) e categorie tramite gli hook TanStack Query esistenti e calcola tutto client-side — stesso pattern già usato da Spese.

## 4. UI — `app/(app)/cashflow/page.tsx` (sola lettura)

Nuova voce sidebar "Cash flow" → nuova route `/cashflow`. Layout dall'alto:

1. Header: titolo + `CashflowPeriodSelector` (3M/6M/12M/24M) + navigazione avanti/indietro (stesso pattern di `ExpensesReferenceNav`).
2. 4 KPI card (`CashflowKpiCards`): Entrate medie, Uscite medie, Flusso netto, Tasso di risparmio — riuso stile `ExpensesKpiCards`.
3. Grafico "Entrate vs uscite" (`CashflowTrendChart`): barre affiancate recharts, colori dai token `--pos`/`--neg` esistenti.
4. "Fonti di entrata" (`IncomeSourcesList`): lista categorie entrata con importo e quota %, nessun donut (lista semplice, coerente con la spec funzionale).
5. "Dove va ogni euro" (`WhereItGoesBreakdown`): 3 voci con importo e % (Fisse / Variabili / Risparmio), riferite al mese corrente.
6. "Risparmio accumulato" (`AccumulatedSavingsChart`): grafico a linea/area + totale, sulla stessa finestra del periodo selezionato.

Tutti i componenti nuovi vivono in `components/domain/cashflow/` con barrel `index.ts` (layer 2, coerente con l'architettura a layer del progetto). Nessun input/bottone in tutta la pagina — sola lettura, come da spec funzionale.

## 5. Testing

- vitest su `lib/calc/cashflow.ts`: KPI, serie mensile, fonti entrata, dove-va-ogni-euro, risparmio accumulato, inclusi edge case (entrate = 0, mese vuoto, risparmio negativo).
- `app/api/transactions/route.test.ts` esteso: `GET` con parametro `type`, `POST` con segno derivato dal tipo categoria.
- Componenti categorie (`add-category-form`, `category-row`) e form Transazioni: test esistenti estesi per la nuova opzione "Entrata"/toggle Spesa-Entrata.

## Fuori scope (esplicitamente rimandato)

- **Trasferimenti interni (giroconti)**: nessuna esclusione da "Uscite medie", nessun modello `isTransfer`. Gap noto già presente nella spec funzionale (Cash flow + Analitiche), da affrontare in una sessione dedicata quando servirà davvero.
- **Investimenti (PAC)** in "Dove va ogni euro": rimandato a quando esisterà la schermata Investimenti con dati reali.
- **i18n**: stringhe in italiano hardcoded, coerente con lo stato attuale del resto del progetto.
