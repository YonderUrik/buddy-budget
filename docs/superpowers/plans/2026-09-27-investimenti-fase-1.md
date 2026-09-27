# Investimenti — Fase 1: portafoglio base — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aprire la schermata `/investimenti`. Si registrano a mano le operazioni (acquisti, vendite, dividendi, cedole, rimborsi) e i PAC. I prezzi di chiusura arrivano ogni sera da una **catena di fonti gratuite con riserva automatica**. Si vedono valore, guadagno, composizione e andamento nel tempo; il valore degli investimenti entra nel patrimonio netto della Panoramica.

**Architecture:**
- **Strumenti, simboli per fonte, prezzi e cambi**: comuni a tutti gli utenti.
- **Portafogli, operazioni, PAC e prezzi manuali**: per utente.
- **Posizioni e valori**: mai salvati. Si calcolano con funzioni pure in `lib/calc/investments.ts` a partire da operazioni + prezzi + cambi.
- **Fonti prezzi**: tutte dietro l'interfaccia `PriceProvider` (`lib/market-data/providers/`). Una funzione di catena (`lib/market-data/chain.ts`) applica le regole della spec, sezione 2.1: ordine per tipo, valuta, fonti disattivate senza chiave, interruttore, budget, plausibilità.
- **Aggiornamento**: un cron serale (`/api/cron/market-prices`) aggiorna gli strumenti posseduti. Il recupero dello storico gira in `after()` con stato su Redis per strumento.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM (Postgres, migration versionate), TanStack Query, Recharts via `components/ui/chart.tsx`, Zod 4, Vitest, `yahoo-finance2` (nuova dipendenza).

**Spec:** `docs/superpowers/specs/2026-09-27-investimenti-design.md` (le sezioni 2.1 e 4 sono il riferimento per ogni task).

**Branch:** `claude/investment-analysis-tool-wbdcvk` (app) e stesso nome nel repo `buddy-budget-infra` per il CronJob (Task 9).

## Global Constraints

- Stringhe visibili in italiano. Nessun colore o raggio hardcoded: solo token del tema.
- JSDoc di una riga su ogni funzione e componente pubblico; tipi delle props esportati; barrel `index.ts` per `components/domain/investments/` e `lib/market-data/`.
- Nessuna logica di business in `app/(app)/investimenti/page.tsx`.
- **Schema solo via migration**: `pnpm db:generate` → migration committata in `lib/db/migrations/` → `pnpm db:migrate` sul DB di sviluppo. Mai `db:push` (non esiste più), mai `ALTER/CREATE` a mano.
- Colonne "a elenco" (`type`, `priceMode`, `provider`, `source`, `frequency`…) sono `text` + costanti TS, non enum Postgres.
- Importi e prezzi: `numeric`, scritti come stringa. Precisioni: quantità `numeric(24,10)`, prezzi e cambi `numeric(20,8)`, importi in valuta utente `numeric(14,2)`.
- **Osservabilità** (standard CLAUDE.md): route esportate con `withRoute("<risorsa>.<azione>", handler)` e nome statico; `bindRequestUser()` dopo il controllo di sessione; niente `console.*`. **Mai nei log** quantità, importi, prezzi pagati o composizione del portafoglio di un utente. Il simbolo di uno strumento comune è loggabile, il legame "questo utente possiede X" no.
- **Fonti esterne mai chiamate nei test**: i provider ricevono `fetch` iniettato, e i test usano fixture salvate in `lib/market-data/providers/__fixtures__/`.
- **Chiavi facoltative** in `lib/env.ts`: `ALPHAVANTAGE_API_KEY`, `STOOQ_API_KEY`, `TWELVEDATA_API_KEY`, `COINGECKO_API_KEY`, `OPENFIGI_API_KEY`. Una chiave assente disattiva la fonte senza errore.
- Test contro il Postgres di sviluppo condiviso: utenti e strumenti di test con id `test-…-${crypto.randomUUID()}`, cancellati in `afterEach`. Mai lanciare il cron vero nei test.
- Comandi: `pnpm exec vitest run <path>`, `pnpm exec tsc --noEmit`, `pnpm lint`.
- Subagent implementer: nessun comando git oltre `git add` e `git commit`.

## File Structure

| File | Responsabilità |
|---|---|
| `scripts/probe-price-sources.ts` (create) | Task 1: prova di copertura delle fonti, salva fixture |
| `lib/db/schema/investments.ts` (create) | Tabelle investimenti + costanti |
| `lib/db/schema/net-worth-snapshots.ts` (modify) | `ASSET_CLASSES` += `"investimenti"` |
| `lib/db/migrations/0001_*.sql` (generate) | Migration |
| `lib/calc/investments.ts` (+ test) | Posizioni, costo medio, realizzato, valore, serie, composizione |
| `lib/calc/fx.ts` (+ test) | Conversione tra valute via EUR |
| `lib/market-data/types.ts` | `PriceProvider`, `FxProvider`, `DailyClose`, `ProviderId`, `ProviderOutcome` |
| `lib/market-data/chain.ts` (+ test) | Esecuzione della catena con le regole della spec 2.1 |
| `lib/market-data/chains.ts` | `PROVIDER_CHAINS` per tipo di strumento |
| `lib/market-data/providers/*.ts` (+ test) | yahoo, stooq, alphavantage, twelvedata, coingecko, kraken, borsaitaliana, ecb, frankfurter, openfigi |
| `lib/market-data/symbols.ts` (+ test) | Risoluzione dei simboli per fonte |
| `lib/market-data/update.ts` (+ test) | Aggiornamento giornaliero e recupero storico (`onProgress`) |
| `lib/market-data/backfill-state.ts` | Stato del recupero storico su Redis, per strumento |
| `lib/validation/investments.ts` (+ test) | Schemi Zod |
| `app/api/instruments/**` | Ricerca, creazione, stato storico, prezzo manuale |
| `app/api/investments/**` | Portafogli, operazioni, PAC, dati del portafoglio |
| `app/api/cron/market-prices/route.ts` (+ test) | Cron serale |
| `lib/observability/metrics.ts` (modify) | `CronName` += `market_prices`, `recordPriceProviderRequest` |
| `lib/net-worth/snapshots.ts`, `lib/calc/net-worth.ts` (modify) | Classe `investimenti` |
| `lib/queries/investments.ts` | Hook TanStack Query |
| `components/domain/investments/*` | UI (dettaglio al Task 13) |
| `app/(app)/investimenti/page.tsx` | Orchestrazione |
| `components/layout/sidebar.tsx`, `components/domain/auth/upcoming-features.data.ts` (modify) | Schermata non più "in arrivo" |
| `buddy-budget-infra: argocd/manifests/app/cronjob-market-prices.yaml` | CronJob |

---

### Task 1: Prova di copertura delle fonti (Fase 0)

Si esegue **fuori dal sandbox cloud** (lì le fonti rispondono 403): in locale e dalla VPS. Serve a confermare `PROVIDER_CHAINS` e a registrare le risposte reali come fixture.

**Files:** create `scripts/probe-price-sources.ts`, `lib/market-data/providers/__fixtures__/*`

- [ ] Script `tsx` senza dipendenze dal DB. Campione di strumenti pubblici:
  - ETF: VWCE (IE00BK5BQT80) su Xetra e Milano, SWDA (IE00B4L5Y983)
  - azione italiana: ENEL (IT0003128367)
  - azione USA: Apple (US0378331005)
  - un BTP e un fondo comune, con ISIN scelti al momento dalle liste pubbliche di Borsa Italiana e Morningstar
  - crypto: bitcoin
  - cambi: USD, GBP, CHF
- [ ] Per ogni coppia fonte × strumento lo script registra: ricerca per ISIN, simbolo trovato, ultime 30 chiusure, valuta, tempo di risposta, codice HTTP. Output: una tabella a console e le risposte grezze salvate come fixture (`<provider>-<caso>.json|csv`), senza chiavi negli URL.
- [ ] Borsa Italiana: provare l'endpoint `grafici.borsaitaliana.it` col token anonimo (vedi la libreria `Librefolio/borsaItaliana-scraping`) e documentare nel file il flusso esatto (URL del token, header, formato della risposta).
- [ ] **L'utente esegue** in locale (`pnpm exec tsx scripts/probe-price-sources.ts`) e dalla VPS. Dalla VPS si usa un Job k8s usa-e-getta nel namespace `app` con l'immagine `migrator`, che contiene `tsx` e le dipendenze di sviluppo. Il manifest del Job va nel runbook in fondo allo script.
- [ ] Riportare l'esito in una tabella nella spec (sezione 3) e correggere l'ordine in `PROVIDER_CHAINS` se serve.
- [ ] Commit: `chore(investimenti): script di prova delle fonti prezzi e fixture`.

**Non blocca i Task 2-8**, che usano fixture sintetiche. Le fixture reali sostituiscono quelle sintetiche appena disponibili.

### Task 2: Schema e migration

**Files:** create `lib/db/schema/investments.ts`; modify `lib/db/schema/index.ts`, `lib/db/schema/net-worth-snapshots.ts`; generate migration

- [ ] Costanti:
  - `INSTRUMENT_TYPES = ["etf","azione","obbligazione","fondo","crypto","etc"]`
  - `PRICE_MODES = ["auto","manuale"]`
  - `PRICE_UNITS = ["unita","percentuale_nominale"]`
  - `PROVIDER_IDS = ["yahoo","borsaitaliana","stooq","alphavantage","twelvedata","coingecko","kraken"]`
  - `INVESTMENT_TRANSACTION_TYPES = ["acquisto","vendita","dividendo","cedola","rimborso"]`
  - `PLAN_FREQUENCIES = ["mensile","bimestrale","trimestrale"]`
- [ ] Tabelle, come da spec 4.1:
  - **`instruments`**: `id`, `isin` (unique parziale `where isin is not null`), `name`, `type`, `currency`, `priceMode`, `priceUnit`, `exchange`, `taxRate numeric(5,4)` con default `0.26`, `taxHarmonized boolean` nullable, `createdByUserId` nullable (FK `auth_user`, `set null`), timestamp.
  - **`instrument_symbols`**: `instrumentId` FK cascade, `provider`, `symbol`, `resolvedAt`; unique `(instrumentId, provider)`.
  - **`instrument_prices`**: `instrumentId`, `date`, `close`, `source`; unique `(instrumentId, date)`; indice `(instrumentId, date desc)`.
  - **`user_instrument_prices`**: `userId`, `instrumentId`, `date`, `close`; unique `(userId, instrumentId, date)`.
  - **`fx_rates`**: `date`, `currency`, `perEur`, `source`; unique `(date, currency)`.
  - **`investment_portfolios`**: `userId`, `name`, `broker`.
  - **`investment_transactions`**: `userId`, `portfolioId` (FK cascade), `instrumentId` (FK restrict), `type`, `date`, `quantity`, `price`, `fxRate`, `fees`, `taxes`, `grossAmount`, `note`; indice `(userId, date)`.
  - **`investment_plans`**: `userId`, `portfolioId`, `instrumentId`, `amount`, `frequency`, `dayOfMonth` (1-28), `active`.
- [ ] `ASSET_CLASSES = ["liquidita", "investimenti"] as const` (colonna text, nessuna migration per questo).
- [ ] `pnpm db:generate` → controllare lo SQL generato (unique parziale su `isin`, FK, indici) → `pnpm db:migrate` sul DB di sviluppo.
- [ ] Test di integrazione minimo: inserimento e unique `(instrumentId, date)`; il vincolo `restrict` impedisce di cancellare uno strumento usato.
- [ ] Commit: `feat(investimenti): schema e migration`.

### Task 3: Calcoli puri del portafoglio

**Files:** create `lib/calc/investments.ts`, `lib/calc/investments.test.ts`, `lib/calc/fx.ts`, `lib/calc/fx.test.ts`

- [ ] `convert(amount, from, to, date, rates)`: passa dall'EUR (`perEur`), usa l'ultimo cambio disponibile ≤ data e lancia un errore tipizzato se non ce n'è nessuno.
- [ ] `computePositions(transactions, asOf)` → per strumento: `quantity`, `averageCost` (costo medio ponderato in valuta utente, commissioni di acquisto incluse), `realizedGain` (vendite e rimborsi rispetto al costo medio, al netto delle commissioni), `income` (dividendi e cedole netti), `investedNet`. Una vendita riduce le quote senza cambiare il costo medio.
- [ ] `validateSell(transactions, candidate)`: false se la vendita supera le quote possedute alla data (usato dalla route al Task 11).
- [ ] `resolvePrice(instrumentId, date, autoPrices, manualPrices)`: ultimo prezzo ≤ data; a parità di data o se più recente vince il manuale. Restituisce anche `priceDate` e `source`.
- [ ] `positionValue`: per `percentuale_nominale` vale `quantity × close / 100`.
- [ ] `computePortfolioSummary(...)` → valore, variazione dall'ultima chiusura precedente, guadagno non realizzato, realizzato, income, totale in € e %.
- [ ] `buildPortfolioSeries(transactions, prices, manual, rates, range)` → punti giornalieri `{ date, value, invested }`, stessa granularità adattiva di `buildNetWorthSeries`: si riusa `getNetWorthPeriodRange`.
- [ ] `computeComposition(positions, by: "type" | "currency")` → percentuali.
- [ ] Test: acquisti multipli e costo medio; vendita parziale e totale; commissioni; obbligazione a percentuale del nominale; strumento in USD con cambio; prezzo manuale più recente dell'automatico; nessun prezzo (valore `null`, mai 0); vendita oltre le quote.
- [ ] Commit: `feat(investimenti): calcoli puri del portafoglio e cambi`.

### Task 4: Catena di fonti (logica, senza fonti vere)

**Files:** create `lib/market-data/types.ts`, `lib/market-data/chain.ts`, `lib/market-data/chain.test.ts`, `lib/market-data/chains.ts`, `lib/market-data/index.ts`

- [ ] `PriceProvider { id; requiresKey: boolean; isEnabled(env): boolean; maxHistory: "unlimited" | "limited"; minDelayMs; fetchDailyCloses(symbol, from, to, deps): Promise<DailyClose[]> }` con `DailyClose { date, close, currency }`. Errori tipizzati: `ProviderRateLimitedError`, `ProviderBlockedError`, `ProviderError`.
- [ ] `PROVIDER_CHAINS: Record<ChainKey, ProviderId[]>` con le chiavi `etf_eu`, `stock_us`, `bond`, `fund`, `crypto`, più `chainKeyFor(instrument)`: le azioni con valuta USD usano `stock_us`, le altre `etf_eu`.
- [ ] `runChain({ instrument, symbols, from, to, purpose: "daily" | "backfill", providers, state, lastClose })` → `{ closes, source, attempts: {provider, outcome}[] }`. Implementa tutte le regole della spec 2.1:
  1. ordine
  2. validità, valuta inclusa
  3. fonte senza chiave → `skipped`
  4. interruttore dopo 3 errori consecutivi, con stato condiviso nell'esecuzione (`ChainRunState`)
  5. budget giornaliero tramite una `BudgetStore` iniettata
  6. per `backfill` solo fonti `unlimited`
  7. plausibilità: >20% da fonte diversa → flag `suspect` (crypto esclusa)
  8. tutte fallite → `closes: []`
- [ ] Test con provider finti: fallback al secondo; valuta sbagliata scartata; fonte senza chiave saltata; interruttore scatta al terzo errore e vale per gli strumenti successivi; budget esaurito; `backfill` salta le fonti `limited`; `suspect` segnalato; fonte senza simbolo saltata.
- [ ] Commit: `feat(market-data): catena di fonti con riserva automatica`.

### Task 5: Fonti principali (Yahoo, BCE, Frankfurter, CoinGecko, Kraken)

**Files:** create `lib/market-data/providers/{yahoo,ecb,frankfurter,coingecko,kraken}.ts` + test; `pnpm add yahoo-finance2`

- [ ] **Yahoo**: `chart()` per lo storico, `search()` per la ricerca per ISIN/nome, con un wrapper che converte le eccezioni della libreria negli errori tipizzati. Per la valuta si usa `meta.currency`. Attenzione: Yahoo indica le sterline in pence (`GBp`), da convertire in `GBP`/100. Va testato.
- [ ] **BCE**: `data-api.ecb.europa.eu` in formato CSV, serie `EXR/D.<CUR>.EUR.SP00.A`, per le valute usate dagli strumenti. **Frankfurter**: stessa forma, come riserva.
- [ ] **CoinGecko**: `market_chart/range` in EUR/USD; header della chiave facoltativo (senza chiave funziona ma è più lento). **Kraken**: OHLC pubblico.
- [ ] Test dei parser sulle fixture (sintetiche finché il Task 1 non fornisce quelle reali): parsing corretto, risposta vuota, 429 → `ProviderRateLimitedError`.
- [ ] Commit: `feat(market-data): fonti Yahoo, BCE, Frankfurter, CoinGecko, Kraken`.

### Task 6: Fonti di riserva (Stooq, Alpha Vantage, Twelve Data, Borsa Italiana)

**Files:** create `lib/market-data/providers/{stooq,alphavantage,twelvedata,borsaitaliana}.ts` + test; modify `lib/env.ts` (+ test)

- [ ] Chiavi facoltative in `lib/env.ts`. Test: l'app si avvia senza.
- [ ] **Stooq**: CSV con `apikey`. **Alpha Vantage**: `TIME_SERIES_DAILY` con `maxHistory: "limited"` e budget di 25/giorno. **Twelve Data**: `time_series` con `maxHistory: "limited"`.
- [ ] **Borsa Italiana**: flusso scoperto al Task 1 (token anonimo + endpoint storico). Se il Task 1 non è ancora stato fatto o se l'endpoint è bloccato, implementare comunque il parser su fixture e tenere la fonte **in fondo** alle catene. Il blocco del firewall (403, pagina di challenge) diventa `ProviderBlockedError`, così scatta l'interruttore.
- [ ] Test dei parser sulle fixture. Test del blocco di Borsa Italiana (risposta HTML invece di JSON).
- [ ] Commit: `feat(market-data): fonti di riserva Stooq, Alpha Vantage, Twelve Data, Borsa Italiana`.

### Task 7: Risoluzione dei simboli e ricerca strumenti

**Files:** create `lib/market-data/symbols.ts` (+ test), `lib/market-data/providers/openfigi.ts`, `app/api/instruments/search/route.ts`, `app/api/instruments/route.ts` (+ test)

- [ ] `resolveSymbols(instrument, yahooHit)`:
  - Yahoo: dalla ricerca.
  - Stooq: derivato dal simbolo Yahoo (`VWCE.DE` → `vwce.de`, `AAPL` → `aapl.us`).
  - Alpha Vantage: suffissi borsa (`.DE` → `.DEX`, `.MI` → `.MIL`, `.L` → `.LON`).
  - Twelve Data: simbolo + `mic_code`.
  - Borsa Italiana: ricerca per ISIN.
  - CoinGecko: id dalla ricerca.
  Mappe in costanti testate. Le fonti non risolte restano senza riga e si ritentano (vedi Task 8).
- [ ] `GET /api/instruments/search?q=` (autenticata, `withRoute("instruments.search")`): cerca prima tra gli strumenti già nel DB, poi su Yahoo, poi su OpenFIGI se `q` è un ISIN. Risultati con nome, ISIN, borsa, valuta, tipo proposto. Per gli ETF propone prima le quotazioni in EUR (Xetra, Milano).
- [ ] `POST /api/instruments`: crea lo strumento o riusa quello esistente con lo stesso ISIN, risolve i simboli e avvia il recupero dello storico (Task 8). Uno strumento `manuale` ha `createdByUserId` e resta visibile solo al suo autore.
- [ ] Test: riuso per ISIN, strumento manuale non visibile a un altro utente, mappe dei suffissi.
- [ ] Commit: `feat(investimenti): ricerca strumenti e risoluzione simboli per fonte`.

### Task 8: Aggiornamento prezzi e recupero storico

**Files:** create `lib/market-data/update.ts` (+ test), `lib/market-data/backfill-state.ts`, `app/api/instruments/[id]/backfill/route.ts`; modify `lib/observability/metrics.ts` (+ test)

- [ ] `updateHeldInstruments({ today, deps, onProgress })`:
  - strumenti `auto` posseduti da almeno un utente (quantità > 0 oggi), più i cambi delle loro valute e di quelle degli utenti;
  - per ognuno `runChain` in modalità `daily` sugli ultimi 7 giorni (copre festivi e buchi), upsert su `instrument_prices` con `source`;
  - riprova a risolvere i simboli mancanti;
  - un errore su uno strumento non ferma gli altri. Restituisce un riepilogo: aggiornati, da riserva, falliti, sospetti.
- [ ] `backfillInstrument(instrumentId, from, { onProgress })`: `runChain` in modalità `backfill` dalla data della prima operazione, inserimento a blocchi da 500 con `onConflictDoNothing`. Idempotente e riprendibile.
- [ ] Stato del recupero su Redis per strumento (`market:backfill:<instrumentId>`, TTL 24h, heartbeat): gli strumenti sono comuni, quindi un solo recupero anche se lo chiedono due utenti. Il lavoro parte in `after()` da `POST /api/instruments` e dalla creazione di un'operazione con data anteriore allo storico presente.
- [ ] `GET /api/instruments/[id]/backfill` restituisce lo stato per il polling. **Deviazione dallo standard "Operazioni lunghe"**, da annotare nel log di CLAUDE.md: l'avanzamento si mostra come badge sulla posizione in `/investimenti`, non nell'indicatore globale, perché si tratta di pochi secondi per strumento e riguarda solo quella pagina.
- [ ] Metriche: `CronName` += `"market_prices"`; `recordPriceProviderRequest(provider, outcome)` con enum chiusi. Log `market.prices.fallback_used` / `market.prices.suspect` / `market.prices.failed` con simbolo e fonte, **mai** l'utente.
- [ ] Test con provider finti e DB di sviluppo: upsert idempotente, fallback registrato in `source`, strumento non posseduto ignorato, recupero riprendibile.
- [ ] Commit: `feat(market-data): aggiornamento giornaliero e recupero storico`.

### Task 9: Cron `market-prices`

**Files:** create `app/api/cron/market-prices/route.ts` (+ test); repo infra: `argocd/manifests/app/cronjob-market-prices.yaml`, `kustomization.yaml`

- [ ] Route copiata dal modello di `app/api/cron/net-worth-snapshot/route.ts`: `isAuthorizedCronRequest`, `maxDuration = 300`, `recordCronRun("market_prices", …)`, `withRoute("cron.market_prices", …)`. Nessun dato utente nella risposta, solo i conteggi del riepilogo.
- [ ] CronJob infra, stesso schema di `cronjob-net-worth-snapshot.yaml`, `schedule: "30 22 * * *"`. Nessun `timeZone`, come gli altri: sono orari UTC, quindi 00:30 in estate e 23:30 in inverno a Roma, dopo la chiusura USA e **prima** di `net-worth-snapshot` (23:50 UTC). Lo stesso ogni giorno, weekend incluso (crypto).
- [ ] Le nuove chiavi facoltative, se l'utente le vuole, vanno nel Secret `app-env` cifrato SOPS. Senza chiavi funzionano comunque Yahoo, Borsa Italiana, BCE, Frankfurter, CoinGecko e Kraken.
- [ ] Test della route: 401 senza segreto, 200 con riepilogo (dipendenze finte).
- [ ] Commit app: `feat(investimenti): cron market-prices`. Commit infra: `feat(app): CronJob market-prices`.

### Task 10: Patrimonio netto con gli investimenti

**Files:** modify `lib/net-worth/snapshots.ts` (+ test), `lib/calc/net-worth.ts` (+ test), `components/domain/net-worth/net-worth-composition-row.utils.ts` (+ test)

- [ ] `writeDailySnapshot` scrive anche la riga `investimenti` (valore del portafoglio con `computePortfolioSummary`), solo se l'utente ha operazioni.
- [ ] Ricostruzione `derivato` degli investimenti dalla prima operazione (massimo 24 mesi, come la liquidità), fatta alla prima operazione registrata: si riusa `buildPortfolioSeries`.
- [ ] `findUsersWithAccounts` include anche gli utenti che hanno solo investimenti.
- [ ] La riga di composizione della Panoramica mostra "Investimenti". Il donut di allocazione rimandato il 2026-09-13 resta fuori da questo piano (va nel backlog).
- [ ] Commit: `feat(panoramica): investimenti nel patrimonio netto`.

### Task 11: API portafogli, operazioni, PAC, prezzi manuali

**Files:** create `lib/validation/investments.ts` (+ test), `app/api/investments/portfolios/route.ts`, `app/api/investments/transactions/route.ts`, `app/api/investments/transactions/[id]/route.ts`, `app/api/investments/plans/route.ts`, `app/api/investments/plans/[id]/route.ts`, `app/api/investments/overview/route.ts`, `app/api/instruments/[id]/manual-prices/route.ts` (+ test per ciascuna)

- [ ] Zod: quantità > 0, prezzo > 0 (tranne `dividendo`/`cedola`, dove conta `grossAmount`), commissioni e imposte ≥ 0, data non futura, `fxRate` facoltativo. Se manca, la route lo precompila dalla BCE alla data.
- [ ] Ownership su portafoglio e operazione (IDOR: stesso schema delle route transazioni). Una `vendita` o un `rimborso` oltre le quote → 400 con messaggio chiaro, usando `validateSell` anche in modifica e cancellazione (cancellare un acquisto non deve rendere negativa una vendita successiva).
- [ ] `GET /api/investments/overview?period=`: operazioni, prezzi, prezzi manuali e cambi degli strumenti dell'utente nel periodo, più lo stato di recupero dello storico. Come Cash flow, i calcoli si fanno lato client con `lib/calc/investments.ts`.
- [ ] Al primo accesso si crea un portafoglio di default "Portafoglio".
- [ ] `track()` Umami dopo l'esito positivo: `investment_transaction_created`, `investment_plan_created` (nuovi nomi in `ProductEvents`, solo props categoriche).
- [ ] Commit: `feat(investimenti): API operazioni, PAC e prezzi manuali`.

### Task 12: Hook TanStack Query

**Files:** create `lib/queries/investments.ts`

- [ ] `useInvestmentsOverviewQuery(period)`, `useInstrumentSearchQuery(q)` (debounce 300 ms), mutation per creare/modificare/eliminare operazioni, PAC, prezzi manuali e strumenti, con invalidazione dell'overview.
- [ ] `useBackfillStatusQuery(ids)` con `refetchInterval` attivo solo mentre almeno uno strumento è in recupero.
- [ ] Commit: `feat(investimenti): hook dati`.

### Task 13: Componenti UI

**Files:** create in `components/domain/investments/`:
- `investments-kpi-cards.tsx`
- `portfolio-chart-card.tsx`: valore vs investito, riusa `NetWorthPeriodSelector`
- `positions-table.tsx`: su mobile diventa una lista a righe, come `TransactionRow`; badge "storico in caricamento" e "prezzo del gg/mm" quando il prezzo non è di oggi
- `portfolio-composition.tsx`: per tipo e per valuta
- `investment-transactions-list.tsx`
- `register-operation-dialog.tsx` e `register-operation-form.tsx`
- `instrument-picker.tsx`: ricerca per nome o ISIN, stesso stile di `CategoryPicker`
- `plans-card.tsx`
- `manual-price-dialog.tsx`
- `index.ts`

- [ ] Stato separato dalla UI: la logica del form (totale calcolato, precompilazione dal PAC, tipo che cambia i campi visibili) va in `register-operation-form.state.ts` con test.
- [ ] Importi con `formatCurrency` di `lib/format.ts`, guadagni con `text-pos`/`text-neg`, niente rosso sulle uscite (stessa regola di `StatCard tone`).
- [ ] Nessun file sopra ~150 righe di JSX.
- [ ] Commit: `feat(investimenti): componenti UI`.

### Task 14: Pagina e "in arrivo"

**Files:** create `app/(app)/investimenti/page.tsx`; modify `components/layout/sidebar.tsx`, `components/domain/auth/upcoming-features.data.ts`

- [ ] La pagina orchestra: caricamento con skeleton, errore con `LoadError`, stato vuoto ("Registra il primo investimento" + ricerca strumento), poi KPI, grafico, posizioni, composizione, PAC, operazioni.
- [ ] Togliere `comingSoon` da Investimenti in `NAV_ITEMS`; togliere Investimenti da `UPCOMING_FEATURES`.
- [ ] Verifica dal vivo con Playwright contro Postgres/Redis locali e provider finti (variabile `MARKET_DATA_FAKE=1`, legge solo le fixture e non si attiva mai in produzione: `lib/env.ts` la rifiuta se `NODE_ENV=production`). Da verificare: 390px e 1280px, registrare un acquisto, una vendita oltre le quote, un prezzo manuale, un PAC con "Registra esecuzione".
- [ ] Commit: `feat(investimenti): pagina /investimenti`.

### Task 15: Chiusura

- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, suite completa `pnpm test`.
- [ ] CLAUDE.md: stato del progetto, log della fase, deviazione dell'indicatore di recupero storico.
- [ ] Messaggio in `#bb-backlog`: Fase 1 → Fatto, nuovi elementi per il donut di allocazione e la verifica manuale.
- [ ] **Verifica manuale utente** in produzione dopo il merge:
  - il primo giro del cron `market-prices` scrive i prezzi, e `source` mostra le fonti usate (query nel runbook);
  - un ETF su Xetra e uno su Milano, un BTP, un fondo e una crypto mostrano prezzi plausibili;
  - il PAC reale registrato a mano torna col prezzo medio di Fineco;
  - la Panoramica mostra Liquidità + Investimenti;
  - dopo 2-3 giorni, in Grafana, le richieste per fonte ed esito (quanto si usano le riserve).
