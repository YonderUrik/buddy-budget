# Debts (Debiti)
Status: draft · Source: `app/(app)/debiti/layout.tsx`, `app/(app)/debiti/page.tsx`, `app/(app)/debiti/finanziamenti/page.tsx`, `app/(app)/debiti/simulatore/page.tsx`, `components/domain/debts/*`, `lib/debts/*`, `lib/calc/debt-plan.ts`, `lib/calc/amortization.ts`, `lib/calc/early-repayment.ts`, `lib/validation/debts.ts`, `lib/queries/debts.ts`, `app/api/debts/**`

## Purpose
Track loans ("finanziamenti") with an amortization plan computed from initial conditions plus an event log (payments, rate changes, balance corrections, early repayments). The user sees what to pay next, where interest weighs most, how to get out of debt sooner, and can simulate extra payments, one-off early repayments and refinancing ("surroga"). Installments are **always marked manually** — never automatically (decision 2026-09-30). Debts are subtracted from net worth (see 02-overview). Available in both IT and DE (no country gating in this area); amounts are in the user's base currency.

## Entry points & navigation
- Main navigation item `Debiti` (`/debiti`).
- Panoramica "Prossime rate" section links to `/debiti` (see 02-overview); sidebar module «Prossime scadenze» (see 00-app-shell-navigation).
- Email "rata in scadenza" alerts (opt-in, see 15-settings) deep-link into the area.
- `/debiti/finanziamenti?id=<debtId>` = loan detail; without `id` the first loan opens.
- `/debiti/simulatore` is a legacy route that redirects to `/debiti/finanziamenti` (simulations now live in each loan detail, "E se…").
- Detail page has a BackLink `‹ Debiti` and, when the user has >1 loan, a row of chips (one per loan name) to switch loan.
- Header (overview only): title `Debiti`, subtitle `Cosa pagare, cosa pesa, come uscirne`, primary button `Aggiungi` opening the Add-debt flow (available from every debts screen).

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** Title «Debiti» + subtitle with the yellow pill «+ Aggiungi»; rows without
> rules; the «segna pagata» circle is an empty 36 ring; «Libero da debiti» / «Interessi risparmiati» in sentence case.
> Loan detail: loan chips first, then the loan name as page title, the yellow «Estinzione anticipata»; «Più ogni mese» and
> «Surroga» answer with `SimulationResult` («Finisci prima di 2 anni e 7 mesi» / «Conviene: risparmi 1094 €»).

### 1. Debts overview (`/debiti`) — «Priorità e azioni»
Single request `GET /api/debts` (stale time 60 s) feeds all cards. Order of content (phone = single column in this order; desktop = 3/5 + 2/5 columns):
1. **Hero**: label `Ancora da restituire`, total residual debt (big money figure), sub-line `{n} finanziamenti · liberi da debiti a {mese anno}` (singular `un finanziamento`) or `Nessun finanziamento aperto`. "Free date" = latest end date among open loans.
2. **`Prossime rate`** (hidden if none): up to 5 next unsettled installments across open loans (`NEXT_DUE_LIMIT = 5`), sorted by date. Each row: date tile (day + abbreviated month `gen…dic`), loan name, relative text (`oggi`, `domani`, `tra N giorni`, `scaduta ieri`, `scaduta da N giorni`; overdue in negative colour, first non-overdue item highlighted), amount, round check button (a11y `Segna pagata la rata di {nome}`) that opens the Pay-installment dialog for that row without entering the loan.
3. **`I tuoi debiti`**: one row per loan (open and finished): name, progress bar (share of principal repaid), detail `finisce a {mese anno} · {TAEG}% TAEG` or `Estinto`, residual amount (no decimals), chevron → loan detail.
4. **`Come uscirne prima`** (hidden when no plan can be built): description `Quanto potresti mettere in più ogni mese? Quell'extra e le rate dei debiti che chiudi vanno prima al tasso più alto.`; slider `Extra al mese` 0–1000, step 50, default 200; ordered timeline per loan (avalanche: highest rate first) with `Chiuso a {mese anno}` + ` invece di {mese anno}` and a badge `−{durata}` when months are saved; footer `Libero da debiti` {mese anno} and `Interessi risparmiati` {amount}; disclaimer `Stima semplificata (rate e tassi costanti, nessuna penale): serve a confrontare, non a prevedere gli importi esatti.`
5. **`Dove paghi di più`** (hidden if no interest): one-year interest at today's balances and rates (big figure + `di interessi in un anno, ai saldi e ai tassi di oggi`), stacked bar of shares, list rows (colour swatch, name, yearly interest, % share) linking to the loan detail.

States (shared "view gate" for overview and detail):
- Loading: two skeleton blocks.
- Error: `Impossibile caricare i debiti.` with retry.
- Empty: title `Tieni d'occhio i tuoi debiti`, text `Aggiungi un finanziamento, nuovo o già in corso: vedrai il piano rata per rata, quanto paghi di interessi e quando finisci.`, primary `Aggiungi un finanziamento` (opens Add flow).

### 2. Add debt flow (dialog, full-screen on phone) — 4 steps with step progress (`Passi per aggiungere un debito`)
Title `Aggiungi un debito`. Reset on every open. Back button `Indietro`, forward `Continua`, final `Aggiungi debito` (`Salvo…` while pending). Success toast `Debito aggiunto`, dialog closes.

- **Step 1 – start mode** (`Il finanziamento parte adesso o è già in corso?`): three tappable options:
  - `Inizia da oggi` (`nuovo`) — `Il finanziamento parte adesso o l'hai appena firmato. Il piano è tutto da pagare.`
  - `Già in corso: ho i dati del contratto` (`origine`) — reconstructs the plan from contract data; past installments become "Da confermare".
  - `Già in corso: parto da com'è oggi` (`fotografia`) — residual today, installment, remaining installments; plan starts today without history.
- **Step 2 – name & date** (`Come si chiama il finanziamento?`): `Nome` (placeholder `Es. Prestito auto`, required, ≤80 chars; error `Dai un nome al debito, per riconoscerlo nell'elenco.`); date field labelled by mode: `Prima rata` / `Data della prima rata` / `Prossima rata`.
- **Step 3 – known data** (`I dati che conosci` — `Compila quelli che hai. Se te ne manca uno, lascialo vuoto: lo calcoliamo dagli altri tre.`): four fields, labels by mode — principal (`Capitale` / `Capitale erogato` / `Residuo di oggi`), `Rata mensile`, installments (`Numero di rate` / `Numero di rate totali` / `Rate rimanenti`), `Tasso annuo (TAN, %)`. Numbers accept Italian formatting (`1.250,50`, `6,9`).
  - With <3 values filled: no error (still typing). With 3: the 4th is computed and shown as placeholder plus notice `Abbiamo calcolato {il capitale|la rata|il numero di rate|il tasso}: {valore}. Può differire di poco da quello della banca, per gli arrotondamenti.` With 4: used as entered.
  - Errors: `Il numero di rate deve essere intero`; amortization-engine errors (e.g. inconsistent inputs) shown inline; generic `Servono almeno tre dati su quattro tra capitale, rata, numero di rate e tasso` on Continue.
- **Step 4 – costs & confirmation** (`Spese accessorie e conferma`): optional expandable `Spese accessorie (facoltativo)`: up to 10 rows of {`Nome della spesa` (placeholder `Es. Assicurazione`), amount, `Quando si paga`: `Una tantum` | `Ogni rata`}, remove `Togli la spesa`, add `Aggiungi una spesa`. Rows with empty label or invalid amount are dropped on submit. Plan preview `Anteprima del piano`: `Rata`, `Finisce a`, `Interessi totali` or `Interessi · TAEG` (TAEG/APR computed only for `nuovo`/`origine` from principal, one-off and per-installment costs).
- Server validation (`POST /api/debts`): name 1–80; startMode ∈ {nuovo, origine, fotografia}; principal >0 ≤1e9; annualRate 0–100; installments int 1–600; firstInstallmentDate `YYYY-MM-DD`; installment optional >0 (sent only if user typed it); `anchorDate` required for `fotografia` (= today); costs ≤10, label 1–80, amount ≥0.
- Errors shown with "report this problem" affordance (`ErrorWithReport`, see 16-help-support).

### 3. Loan detail (`/debiti/finanziamenti?id=`)
- **Header**: loan name, start-mode label (`Nuovo` / `In corso · dall'origine` / `In corso · fotografia di oggi`). Actions: `Estinzione anticipata` (disabled when finished), `Cambio tasso`, `Correggi residuo`, `Elimina` (destructive).
- **Facts**: progress ring `{x}% restituito`; residual (big) + `ancora da restituire · finisce a {mese anno}` or `Estinto`; grid `Rata` (— if finished), `Rate rimaste`, `Tasso (TAN) · TAEG`, `Interessi che restano`.
- **Pending banner** (only if past installments are unsettled): overdue → `Una rata è scaduta e non l'hai segnata come pagata.` / `{n} rate sono scadute e non l'hai segnata come pagata.`; unconfirmed (origine) → `Il piano conta una rata già passata: se le hai pagate, confermale.` / `{n} rate già passate`. Button `Segna tutte come pagate` → bulk-pays all past unsettled installments up to the last one with plan date and amount; toast `Una rata segnata come pagata` / `{n} rate segnate come pagate`.
- **`E se…`** panel (hidden when finished): segmented control `Più ogni mese` | `Una tantum` | `Surroga`. Simulations never write data.
  - `Più ogni mese`: slider `Extra al mese` 0–1000 step 50 default 200 → `Finisci {durata} prima ({mese anno} invece di {mese anno}) e risparmi {importo} di interessi.`; at 0 or no gain: `Muovi lo slider per vedere quanto anticipi la fine e quanto risparmi.`; footnote `Stima semplificata: rata e tasso costanti, nessuna penale.`
  - `Una tantum`: explanatory text and button `Simula l'estinzione` → opens Early-repayment dialog.
  - `Surroga`: inputs `Nuovo TAN (%)` (placeholder `es. 3,5`), `Numero di rate` (placeholder = remaining installments), `Spese della nuova offerta` (hint `Istruttoria, perizia, imposte`), `Penale di estinzione` (hint `Quella sul finanziamento attuale`). Needs rate ≥0 and integer installments ≥1, else hint `Inserisci almeno il nuovo tasso e il numero di rate per vedere il confronto.` Result: two columns `Resti dove sei` (Rata, Finisci, Interessi che restano) vs `Cambi con la nuova offerta` (Rata, Finisci, Interessi, Spese e penale) and verdict `Conviene: risparmi {x} al netto delle spese, e le spese rientrano in {n} mesi.` or `Non conviene: spenderesti {x} in più tra interessi e spese.`
- **`Cosa hai registrato`** (event log), newest first: `Rata {n} pagata · {importo}`, `Tasso portato al {x}%`, `Estinzione anticipata di {importo} · rata ridotta|durata ridotta · penale {importo}`, `Residuo corretto a {importo}`, with date and a delete icon (`Elimina evento`) — **deleted immediately, no confirmation**; the plan recalculates. Empty: `Ancora nessun evento: segna una rata pagata o registra un cambio.`
- **`Piano delle rate`**: by default the last 2 past + next 8 installments; toggle `Mostra tutte le {n} rate (altre {m})` / `Mostra meno`. Each installment: number, due date, amount (actual paid amount if recorded), capital, interest, residual, status. Status badge `Pagata` / `Da pagare` / `Scaduta` / `Da confermare` (origine mode, past). Unpaid rows have `Segna pagata`. Phone already uses one card per installment.
- **Delete loan** confirmation: title `Eliminare «{nome}»?`, body `Spariscono il piano e tutto ciò che hai registrato su questo debito. Le transazioni collegate restano dove sono.`, buttons `Annulla` / `Elimina`. On success → navigate to `/debiti`.

### 4. Pay installment dialog (`Rata {n} pagata`)
- Subtitle `Data e importo reali, precompilati dal piano.`
- `Data del pagamento` (default: due date if past, else today), `Importo pagato` (hint `Quello realmente addebitato`, default plan installment; must be >0, error `Inserisci l'importo pagato`).
- Optional expandable `Collega una transazione (facoltativo)` — `Solo un promemoria: non cambia la transazione.` Picker lists expense transactions within ±20 days of the due date, ranked with amounts matching the expected installment first, filterable by text and category; tap to select/unselect (single choice), selected chip `Collegata: {descrizione} · {importo}` with unlink. States: `Cerco le transazioni…`, `Nessuna uscita vicina alla scadenza.`, `Nessuna transazione corrisponde ai filtri.` Never links automatically.
- Submit `Segna pagata`.

### 5. Simple event dialog (`Cambio di tasso` / `Correggi il residuo`)
- Rate change: `Dalla data` (default today), `Nuovo tasso annuo (TAN, %)` (hint `Quello scritto dalla banca`), 0 allowed; description `Dalla data indicata le rate si ricalcolano al nuovo tasso, con lo stesso numero di rate.` Submit `Registra cambio tasso`.
- Balance correction: `Dalla data`, `Capitale residuo reale` (hint `Lo trovi sull'estratto o nell'area clienti della banca`, must be >0); description `Se il residuo reale è diverso da quello del piano (rate saltate, sospensioni, estinzioni parziali), indicalo: il piano riparte da lì.` Submit `Correggi il residuo`.
- Invalid → `Inserisci un valore valido`. Server: rate 0–100, amount ≥0, note ≤500 (not exposed in UI).

### 6. Early repayment dialog (`Estinzione anticipata`)
- Description `Vedi cosa cambia prima di decidere. Se l'hai già fatto, scegli l'alternativa che la banca ti ha applicato e registrala.`
- Segmented `Una volta` | `Ogni mese (simula)`; switching mode clears amount and choice.
- Once: `Importo che estingui`, `Data` (default today), `Penale di estinzione (facoltativa)` with unit `€` | `% della somma` (hint `La trovi nel contratto: spesso fino all'1% della somma`). Preview `Cosa cambia`: baseline sentence (`Senza estinzione: rata …, fine …, ancora … di interessi.`) and two selectable cards `Riduci la rata` (`Stessa scadenza, rata più bassa`) and `Riduci la durata` (`Stessa rata, finisci prima`), each with `Prossima rata`, `Finisci` (+ `N mesi prima`/`stessa scadenza`), `Interessi risparmiati`, `Al netto della penale`. Button `Scegli un'alternativa per registrarla` (disabled) → after choosing `Registra come fatto`.
- Monthly (simulation only): `Extra ogni mese` → `Con {x} in più ogni mese`: `Finisci`, `Interessi risparmiati`, `Versato in extra in totale`, note `È solo una simulazione: non si registra. Per registrarle, inserisci le singole estinzioni quando le fai.` No submit.
- Validation messages: `Inserisci un importo valido`, `Indica la data`, `La data è dopo l'ultima rata del piano`, `La penale non è valida`, `Il debito è già concluso`.

## Requirements

#### Overview
- **DEBT-001** The app shall load all debts, plans, totals and next dues with a single request and reuse it for overview and detail screens. _API: `GET /api/debts`_
- **DEBT-002** The app shall show the total residual debt, the number of open loans and the month/year in which the last open loan ends ("liberi da debiti a …"), or `Nessun finanziamento aperto`.
- **DEBT-003** The app shall list up to 5 next unsettled installments across all open loans, sorted by due date, each with loan name, relative due text, amount and overdue highlighting.
- **DEBT-004** The app shall let the user mark an upcoming installment as paid directly from the overview list via the Pay-installment dialog.
- **DEBT-005** The app shall list every loan with name, repaid-share progress bar, end month/year and TAEG (when known) or `Estinto`, residual amount, and open its detail on tap.
- **DEBT-006** The app shall provide an "exit faster" simulation with an extra-per-month slider (0–1000, step 50, default 200) that allocates the extra and freed installments to the highest-rate loan first (avalanche) and shows per-loan close dates, months saved, debt-free date and interest saved.
- **DEBT-007** The app shall show the interest paid in one year at today's balances and rates, in total and split per loan with percentage share, each row linking to the loan detail.
- **DEBT-008** The app shall show a loading placeholder, an error state with retry, and an empty state with a `Aggiungi un finanziamento` call to action when the user has no debts.

#### Add debt
- **DEBT-009** The app shall offer three start modes when adding a debt: new (`nuovo`), in progress from contract data (`origine`), in progress from today's snapshot (`fotografia`).
- **DEBT-010** The app shall require a non-empty name (max 80 characters) and a first/next installment date before creating a debt.
- **DEBT-011** The app shall compute the missing value among principal, monthly installment, number of installments and annual rate when exactly three are provided, and clearly state which value was calculated.
- **DEBT-012** The app shall reject a non-integer number of installments and installments outside 1–600, rates outside 0–100% and principal ≤0.
- **DEBT-013** The app shall parse amounts typed in the user's locale (e.g. `1.250,50`).
- **DEBT-014** The app shall allow up to 10 optional ancillary costs, each with label, amount and kind (`Una tantum` or `Ogni rata`).
- **DEBT-015** The app shall show a plan preview (installment, end date, total interest, and TAEG for non-snapshot modes) before confirmation.
- **DEBT-016** The app shall create the debt and confirm with `Debito aggiunto`. _API: `POST /api/debts`_
- **DEBT-017** The app shall send the installment only when typed by the user and set the snapshot date to today for `fotografia` debts. _API: `POST /api/debts`_

#### Loan detail
- **DEBT-018** The app shall show, for a loan, the residual amount, repaid percentage, end date, current installment, remaining installments, TAN · TAEG and remaining interest.
- **DEBT-019** The app shall allow switching between loans from the detail screen when the user has more than one.
- **DEBT-020** The app shall warn about past installments that are overdue (`scaduta`) or unconfirmed (`da_confermare`) and offer to mark all of them as paid in one action. _API: `POST /api/debts/{id}/payments/bulk`_
- **DEBT-021** The app shall show the amortization plan with the last 2 past and next 8 installments by default and allow expanding to all installments.
- **DEBT-022** The app shall show each installment's number, due date, amount (actual paid amount if recorded), capital, interest, residual and status (`Pagata`, `Da pagare`, `Scaduta`, `Da confermare`).
- **DEBT-023** The app shall let the user mark an installment as paid with date (default: due date if past, else today) and paid amount (>0, default plan amount). _API: `POST /api/debts/{id}/events` (type `payment`)_
- **DEBT-024** The app shall let the user optionally link one expense transaction within ±20 days of the due date to a payment, ranking same-amount transactions first and filtering by text and category, without modifying the transaction. _API: `GET /api/transactions?from=&to=&type=uscita`, `GET /api/categories`_
- **DEBT-025** The app shall let the user record a rate change from a date (rate 0–100%). _API: `POST /api/debts/{id}/events` (type `rate_change`)_
- **DEBT-026** The app shall let the user record a residual-balance correction from a date (amount >0). _API: `POST /api/debts/{id}/events` (type `balance_correction`)_
- **DEBT-027** The app shall list recorded events newest first with a human description and date, and allow deleting an event, after which the plan is recalculated. _API: `DELETE /api/debts/{id}/events/{eventId}`_
- **DEBT-028** The app shall delete a loan with all its events only after a confirmation dialog stating that linked transactions remain, then return to the overview. _API: `DELETE /api/debts/{id}`_
- **DEBT-029** The app shall disable early repayment and hide the "E se…" panel for finished loans.

#### Simulations & early repayment
- **DEBT-030** The app shall simulate a recurring monthly extra on a single loan (slider 0–1000, step 50, default 200) showing months saved, new end date and interest saved, without saving anything.
- **DEBT-031** The app shall simulate refinancing ("surroga") given new TAN, number of installments, new-offer costs and current penalty, comparing installment, end date and interest of both options and stating net saving and break-even months.
- **DEBT-032** The app shall preview a one-off early repayment (amount, date, penalty in currency or % of amount) as two alternatives — reduce installment vs reduce duration — with next installment, end date, months saved, interest saved and net-of-penalty benefit.
- **DEBT-033** The app shall reject an early-repayment date after the last installment of the plan and invalid amounts or penalties with an inline message.
- **DEBT-034** The app shall record a one-off early repayment only after the user picks the alternative applied by the bank. _API: `POST /api/debts/{id}/events` (type `early_repayment`, `effect` = `reduce_installment` | `reduce_duration`)_
- **DEBT-035** The app shall offer a monthly-extra mode in the early-repayment dialog that is simulation-only and cannot be recorded.

#### Cross-cutting
- **DEBT-036** The app shall never mark installments as paid automatically; payments are only created by explicit user actions.
- **DEBT-037** The app shall refresh all debt figures after any create, delete or event mutation.
- **DEBT-038** The app shall redirect the legacy simulator route to the loan detail.

## Mobile adaptation notes
- **Proposal — needs product sign-off:** Overview cards stack in the web phone order (Hero → Prossime rate → I tuoi debiti → Come uscirne prima → Dove paghi di più). Loan detail order: header → facts → pending banner → E se… → Cosa hai registrato → Piano delle rate.
- **Proposal — needs product sign-off:** The four detail header actions become: primary button `Estinzione anticipata` visible, the other three (`Cambio tasso`, `Correggi residuo`, `Elimina`) in a "⋯" overflow menu in the navigation bar; `Elimina` styled destructive.
- **Proposal — needs product sign-off:** Loan switching chips become a horizontally scrollable chip row under the title (same as web phone); alternatively navigate back to the list. Keep one behaviour on both platforms: chip row.
- **Proposal — needs product sign-off:** Amortization plan uses one card per installment (as web phone already does); "Mostra tutte" loads the full list lazily in the same scroll view.
- **Proposal — needs product sign-off:** Event deletion, which has no confirmation on web, uses swipe-to-delete with an undo snackbar (5 s) on both platforms instead of an immediate destructive tap; the API delete is sent when the snackbar expires.
- **Proposal — needs product sign-off:** Date inputs use the native date picker; numeric inputs use decimal keypad with locale decimal separator.
- **Proposal — needs product sign-off:** Sliders snap to 50 steps with haptic tick on each step; the result text updates live.
- **Proposal — needs product sign-off:** Add-debt and event dialogs are full-screen modal flows with a step indicator and a top-left close; dismissal mid-flow discards data (as web, which resets on each open).

## Open questions
1. `PATCH /api/debts/{id}` (rename and edit costs) exists but no UI uses it; CLAUDE.md lists "modifica dei dati di un debito dalla UI" as deferred. Should mobile expose rename/costs editing?
2. Event deletion has no confirmation or undo on web — acceptable for mobile, or adopt the undo proposal?
3. Linking transactions requires the transactions API window query; for users with no linked bank the picker is always empty — hide the section in that case?
4. Several strings are concatenated from fragments (e.g. `Rata` + n + `pagata`, `Finisci` … `prima`), and `monthsLabel`, `dueText`, month abbreviations and `un finanziamento` are hard-coded Italian outside `t()` — they will not translate correctly; mobile needs proper pluralised keys.
5. Number parsing assumes Italian format (`parseAmount` treats `,` as decimal); for `en`/`de` users this may misread `1,250.50`. Define locale-aware parsing for mobile.
6. Simulations (extra, surroga, early repayment, exit plan) run client-side with `lib/calc/*`; mobile must either port these engines identically to both platforms or obtain a server endpoint — none exists today.
7. Debts only support one currency (user base currency) and only `loan` kind (credit Lombard removed); confirm no other debt kinds must be shown.
8. Default extra (200) and max (1000) are in absolute currency units regardless of currency — confirm for non-EUR users.
