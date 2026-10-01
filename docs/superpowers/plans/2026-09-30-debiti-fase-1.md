# Debiti, Fase 1 (motore e finanziamenti): piano di implementazione

Spec: `docs/superpowers/specs/2026-09-30-debiti-design.md`. Branch: `claude/debiti-feature-brainstorm-9fmwa8`. Stato: **eseguito il 2026-10-01** (10/10 task, branch non ancora mergiato). Differenze rispetto a quanto scritto sotto: aggiunta la route `POST /api/debts/[id]/payments/bulk` per segnare in blocco il pregresso; il grafico del residuo parte da oggi; una rata che scade oggi è ancora da pagare.

**Obiettivo della fase**: finanziamenti (`loan`) nuovi o in corso, piano di ammortamento calcolato da condizioni iniziali + registro eventi, calcolatore della variabile mancante, rate segnate pagate a mano, schede Panoramica e Finanziamenti. **Fuori da questa fase**: estinzioni anticipate (Fase 2), linee di credito/Lombard (Fase 3), patrimonio netto, simulatore, extra investimenti (Fase 4).

Convenzioni del progetto da rispettare in ogni task: italiano nei testi, JSDoc su funzioni e componenti pubblici, barrel `index.ts` per cartella feature, nessun colore/valore hardcoded nei componenti (token tema), logica di business fuori dai file di route, `withRoute("<risorsa>.<azione>", …)` + `bindRequestUser` su ogni route, nessun `console.*`, schema solo via `pnpm db:generate` + migration committata, nessun dato personale (importi, nomi) in log o metriche.

## Decisioni di design prese scrivendo il piano (rivedono la spec, sezione 3)

1. **Niente tabella `debt_rate_periods`.** Un cambio di tasso è un evento `rate_change` nel registro, come tutto il resto: una tabella in meno.
2. **Modello a "ancore".** Il piano è una sequenza di segmenti. Ogni segmento parte da un'**ancora** `(data, capitale residuo, tasso annuo, rate rimanenti)`. Ancora iniziale = condizioni del debito (modalità *nuovo* e *ricostruisci dall'origine*) oppure la fotografia di oggi (modalità *fotografia*). Gli eventi `rate_change` e `balance_correction` aprono un nuovo segmento; nella Fase 2 lo farà anche l'estinzione anticipata. Le rate già concluse restano quelle del segmento precedente (congelate). Questa scelta rende la Fase 2 un'aggiunta e non una riscrittura.
3. **Convenzione degli interessi**: rata periodica, interesse del periodo = residuo × tasso annuo / 12 (TAN nominale annuo, rata mensile posticipata). Il TAEG è il tasso interno di rendimento annualizzato dei flussi (capitale erogato − spese iniziali, poi rate + spese per rata). Importi arrotondati al centesimo a ogni rata e l'ultima rata assorbe la differenza di arrotondamento.
4. **Il calcolatore della variabile mancante gira sul client** (funzioni pure in `lib/calc/amortization.ts`), nessuna route: non tocca dati e deve rispondere mentre l'utente digita.
5. **Ammortamento all'italiana** e periodicità diverse da quella mensile restano fuori (spec, sezione 10).

## Mappa dei file

| Nuovo | Scopo |
|---|---|
| `lib/calc/amortization.ts` (+ `.test.ts`, `.properties.test.ts`) | rata, piano di un segmento, solver delle 4 grandezze, TAEG |
| `lib/calc/debt-plan.ts` (+ `.test.ts`) | applica ancora iniziale + eventi, produce righe di piano con stato e totali |
| `lib/db/schema/debts.ts` (+ integration test) | tabelle `debts`, `debt_events`; export da `schema/index.ts` |
| `lib/db/migrations/0008_debiti_fase_1.sql` | generata da `pnpm db:generate` |
| `lib/validation/debts.ts` (+ test) | schemi Zod di creazione debito, evento, modifica |
| `lib/debts/data.ts`, `lib/debts/view.ts` (+ test) | caricamento dati dell'utente, costruzione della vista per le schede |
| `app/api/debts/**` (+ `routes.test.ts`) | route CRUD debiti ed eventi |
| `lib/queries/debts.ts` | hook TanStack Query e mutation |
| `components/domain/debts/**` | tabs, layout actions, panoramica, finanziamenti, dialog, calcolatore |
| `app/(app)/debiti/{layout,page}.tsx`, `app/(app)/debiti/finanziamenti/page.tsx` | route |
| Modificati: `components/layout/sidebar.tsx`, `components/domain/auth/upcoming-features.data.ts`, `lib/analytics/track.ts`, `lib/account/{lifecycle,export}.ts` (+ test), `CLAUDE.md`, spec |

## Task

### Task 1: motore di ammortamento (puro)

File: `lib/calc/amortization.ts`, test accanto.

Funzioni pubbliche (tutte pure, JSDoc in italiano):
- `installmentAmount(principal, annualRate, installments)`: rata costante (con tasso 0 → capitale / n).
- `buildSegmentSchedule({ startDate, principal, annualRate, installments, installment? })`: righe `{ number, dueDate, installment, interest, capital, residual }`. Senza `installment` lo calcola. L'ultima rata chiude il residuo a 0 assorbendo gli arrotondamenti. Le scadenze cadono lo stesso giorno del mese della prima rata, limitato all'ultimo giorno dei mesi corti (senza overflow, lezione di `addMonths` del 2026-07-28).
- `solveAnnualRate({ principal, installment, installments })`: bisezione sul tasso (0 ≤ tasso ≤ 100%); errore esplicito se la rata non copre nemmeno il capitale (nessun tasso ≥ 0 è compatibile).
- `solveInstallments({ principal, annualRate, installment })`: numero rate per eccesso; errore se la rata non supera gli interessi del primo mese.
- `solvePrincipal({ annualRate, installment, installments })`.
- `computeApr({ principal, upfrontCosts, installment, recurringCosts, installments })` → TAEG annuo con la stessa bisezione sul tasso mensile interno.
- `resolveMissingLoanInput(partial)`: riceve un oggetto con esattamente una grandezza mancante tra capitale/rata/rate/tasso e restituisce le quattro complete (o un errore leggibile se le incognite sono due o più o i dati sono incompatibili).

Test: valore noto (10.000 € al 6% su 12 rate → 860,66 €), tasso 0, ultima rata che chiude il residuo a 0,00, scadenze a fine mese (31 gennaio → 28/29 febbraio → 31 marzo con lo stesso "giorno 31" richiesto), ogni solver inverso coerente con il diretto (andata e ritorno, tolleranza di un centesimo sulla rata e 1e-6 sul tasso), errori sui dati impossibili. Proprietà su scenari deterministici (seed fisso): somma delle quote capitale = capitale, somma degli interessi = somma delle rate − capitale, residuo mai negativo e monotono decrescente.

Verifica: `pnpm test lib/calc/amortization` verde, `pnpm tsc --noEmit` pulito.

### Task 2: piano da ancore ed eventi (puro)

File: `lib/calc/debt-plan.ts`, test accanto.

Tipi: `DebtTerms` (capitale, tasso, n. rate, data prima rata, modalità di avvio, ancora iniziale), `DebtEvent` (`payment` con `installmentNumber`, data, importo reale, `transactionId`; `balance_correction` con data e residuo reale; `rate_change` con data e nuovo tasso), `LoanPlanRow` con `status: "pagata" | "da_pagare" | "scaduta" | "da_confermare"` (il pregresso ricostruito senza conferma è `da_confermare`).

`buildLoanPlan(terms, events, today)` → `{ rows, totals }`:
- totali: capitale residuo a oggi, rata corrente, interessi pagati (righe pagate con l'importo reale ripartito in quota interessi calcolata dal piano), interessi ancora da pagare, data dell'ultima rata, rate rimaste;
- un evento `rate_change` o `balance_correction` apre un nuovo segmento dalla rata successiva alla sua data, con residuo ricalcolato (la correzione impone il residuo indicato) e rate rimanenti invariate; le righe precedenti restano quelle del segmento vecchio;
- modalità *fotografia di oggi*: nessuna riga prima della data dell'ancora;
- un `payment` su una rata inesistente o già pagata è ignorato e segnalato in `warnings` (l'API lo rifiuta prima, questo è solo difesa).

Test: debito nuovo interamente `da_pagare`; in corso con ricostruzione e metà rate `da_confermare`; pagamenti reali con importo diverso; cambio tasso a metà (rata ricalcolata, righe precedenti invariate); correzione del residuo; fotografia di oggi; rata scaduta non pagata; totali coerenti con la somma delle righe.

### Task 3: schema e migration

File: `lib/db/schema/debts.ts` + export in `schema/index.ts`; migration generata.

- `debts`: `id`, `userId` (FK `auth_user`, cascade), `kind` (text + costante `DEBT_KINDS = ["loan", "credit_line"]`, in Fase 1 si creano solo `loan`), `name`, `startMode` (`"nuovo" | "origine" | "fotografia"`), `principal`, `annualRate` (numeric 7,4), `installments`, `firstInstallmentDate`, `installment` (rata dichiarata dall'utente, può differire da quella calcolata), `anchorDate`, `anchorResidual` (solo per *fotografia*), `costs` (jsonb: lista `{ label, amount, kind: "una_tantum" | "per_rata" }`), `createdAt`/`updatedAt`. Indice per `userId`.
- `debt_events`: `id`, `debtId` (FK cascade), `userId` (FK cascade, per le query e la pulizia dell'account), `type` (text + costante `DEBT_EVENT_TYPES`), `date`, `amount` (nullable), `installmentNumber` (nullable), `rate` (nullable, numeric 7,4), `transactionId` (nullable, FK `transactions` con `set null`), `note`, `createdAt`. Vincolo unico parziale: una sola `payment` per `(debtId, installmentNumber)`.
- Colonne `text` + costanti TS (non enum Postgres), come `ASSET_CLASSES`.

Eseguire `pnpm db:generate`, committare la migration, applicarla con `pnpm db:migrate` sul DB di sviluppo. Test d'integrazione (stile `investments.integration.test.ts`): inserimento, cascata alla cancellazione dell'utente, unicità del pagamento per rata.

### Task 4: validazione, dati e vista

File: `lib/validation/debts.ts`, `lib/debts/data.ts`, `lib/debts/view.ts`.

- Schemi Zod: `createDebtSchema` (con le regole per modalità: *nuovo*/*origine* richiedono i dati contrattuali, *fotografia* richiede `anchorResidual`, `anchorDate` e rate rimanenti; tasso 0–100, importi > 0, date valide), `updateDebtSchema`, `createDebtEventSchema` (un'unione discriminata per tipo).
- `loadUserDebts(userId)` e `buildDebtsView(debts, events, today)` che usa `buildLoanPlan` e produce: per debito `{ debt, plan, totals }`, e la panoramica `{ totalResidual, monthlyPayment, interestPaidToDate, interestRemaining, debtFreeDate, nextDue[], residualSeries[] }` (serie del residuo mese per mese fino alla fine). Nessuna query dentro i loop.
- La scheda Panoramica mostra "Rata mensile" come somma delle rate correnti dei debiti ancora aperti.

Test unitari della vista (più debiti, nessun debito, debito estinto).

### Task 5: route API

Sotto `app/api/debts/`, tutte con `withRoute("debts.<azione>", …)` e `bindRequestUser`:
- `GET /api/debts` → vista completa (un solo caricamento per entrambe le schede).
- `POST /api/debts` (201), `PATCH`/`DELETE /api/debts/[id]` (ownership sempre verificata: un id di un altro utente dà 404).
- `POST /api/debts/[id]/events` (rifiuta con 400 un `payment` su rata inesistente o già pagata, con 404 una `transactionId` non dell'utente), `DELETE /api/debts/[id]/events/[eventId]`.
- Evento Umami `debt_added` ({ startMode }) e `debt_event_added` ({ type }) dal client dopo l'esito positivo (vedi Task 6), aggiunti a `ProductEvents`.

Test d'integrazione (stile `fase-4-routes.test.ts`): 401, IDOR su debito ed evento, doppio pagamento della stessa rata, transazione di un altro utente, creazione per le tre modalità, eliminazione con cascata degli eventi.

### Task 6: query e mutation

`lib/queries/debts.ts`: `useDebtsQuery` (staleTime moderato), mutation di creazione/modifica/eliminazione debito e di aggiunta/eliminazione evento, che invalidano la query e chiamano `track(...)` dopo l'esito positivo. Stessa struttura di `lib/queries/investments.ts`.

### Task 7: struttura UI e scheda Panoramica

- `app/(app)/debiti/layout.tsx`: titolo, bottone "Aggiungi debito", `SectionTabs` con `DEBTS_TABS` (Panoramica `/debiti`, Finanziamenti `/debiti/finanziamenti`; le schede Lombard e Simulatore arrivano con le loro fasi). Modello: `app/(app)/movimenti/layout.tsx` e `components/domain/investments/investments-tabs.tsx`.
- `DebtsViewGate` (caricamento, errore, nessun debito con invito ad aggiungerne uno), copiato nello stile di `InvestmentsViewGate`.
- Scheda Panoramica: quattro cifre (debito totale, rata mensile, interessi pagati, interessi ancora da pagare), frase sulla data di libertà dai debiti, grafico del residuo (area, con `dataviz` e token tema), prossime scadenze. Componenti separati, sotto le ~150 righe di JSX ciascuno.

### Task 8: scheda Finanziamenti e dialog

- Elenco di card (nome, residuo, rata, prossima scadenza, barra di avanzamento) con selettore per aprire il piano di ciascun debito (correzione dello stub del mockup).
- Dettaglio: tabella del piano rata per rata (numero, scadenza, capitale, interessi, residuo, stato), segnare pagata una rata (dialog con data e importo reale precompilati dal piano, collegamento **facoltativo** a una transazione tramite picker), "segna pagate in blocco fino alla rata N" per il pregresso, cambio tasso, correzione del residuo, eliminazione del debito con conferma.
- **Dialog "Aggiungi debito"**: prima domanda "nuovo o in corso?", e se in corso scelta tra *ricostruisci dall'origine* e *fotografia di oggi*, con una spiegazione di due righe per ciascuna (testi in costanti named). Campi di capitale, rata, numero rate e tasso con il calcolatore di `resolveMissingLoanInput`: se l'utente ne lascia vuota una, il campo si compila da solo e resta modificabile, segnato "calcolato", con TAEG se ci sono spese. Spese accessorie come lista libera (etichetta, importo, una tantum o per rata).
- Stato del form in un file separato testato (come `register-operation-form.state.ts`).

### Task 9: integrazioni minori

- `lib/account/lifecycle.ts` (riepilogo dati, reset, eliminazione) e `lib/account/export.ts` (JSON + CSV `debiti.csv`, `debiti-eventi.csv`) con i relativi test.
- Sidebar: togliere `comingSoon` da Debiti; `upcoming-features.data.ts`: rimuovere la voce Debiti (vedi CLAUDE.md, schermate "in arrivo").
- Verificare che `proxy.ts` e il layout `(app)` non richiedano altro (la route è dietro sessione come le altre).

### Task 10: verifica e documentazione

- `pnpm tsc --noEmit`, `pnpm lint`, suite completa `pnpm test` (DB di sviluppo migrato).
- Prova dal vivo con Playwright su Postgres/Redis locali (stesso metodo delle sessioni Investimenti, utente di prova con login via magic link letto dal DB): creare i tre tipi di debito, segnare rate pagate (singole e in blocco), cambio tasso, correzione del residuo, calcolatore (tasso dalla rata), schermate desktop chiaro e 390 px scuro, guardando gli screenshot alla ricerca di difetti di layout.
- Aggiornare `CLAUDE.md` (Stato del progetto e log), la spec (decisioni 1–5 di questo piano) e `docs/functional-spec.md` sezione 7 dove cambia il comportamento; pubblicare l'aggiornamento di stato in `#bb-backlog`.
- **A carico dell'utente dopo il merge**: nessuna azione manuale oltre al Job PreSync che applica la migration; verificare a mano sui propri dati il pregresso del finanziamento (modalità *origine* contro *fotografia*) e il tasso calcolato dalla rata contro quello del contratto.

## Rischi e punti da tenere d'occhio

- **Arrotondamenti**: una banca può arrotondare la rata diversamente (quindi la rata dichiarata dall'utente vince su quella calcolata, e l'ultima rata assorbe la differenza). Per questo `installment` è salvato sul debito.
- **Piano teorico contro realtà**: sospensioni, rinegoziazioni e rate saltate non coincidono col piano; la correzione del residuo è il rimedio previsto e va spiegata nell'interfaccia.
- **Scadenze a fine mese**: il giorno 29–31 è la classica fonte di overflow (vedi log 2026-07-28); coperto da test nel Task 1.
- **Dimensioni**: i componenti di dettaglio e dialog sono il punto dove è più facile superare le ~150 righe di JSX; dividerli subito.
