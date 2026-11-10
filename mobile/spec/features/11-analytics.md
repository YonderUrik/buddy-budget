# Analytics (Analitiche — "Risposte" / FIRE planning)
Status: draft · Source: `app/(app)/analitiche/layout.tsx`, `app/(app)/analitiche/page.tsx`, `app/(app)/analitiche/{costi,crescita,prelievi,rischio,simulazione}/page.tsx` (legacy redirects), `components/domain/analytics/**`, `lib/analitiche/**`, `lib/calc/monte-carlo.ts`, `lib/calc/costs.ts`, `lib/queries/analytics.ts`, `app/api/analytics/{assumptions,walkthrough}/route.ts`

## Purpose
Answer, from the user's real data plus editable assumptions, four questions about financial independence (FIRE): how far along am I, when can I stop working, will my wealth last, and what does my portfolio cost me. "What if" sliders let the user try savings, spending, real return and withdrawal rate without saving; a full assumptions form persists the defaults. Technical depth lives in collapsible «Per esperti» panels (FIRE number, coast FIRE, sensitivity grid, growth split, Monte Carlo, withdrawal-rule comparison, portfolio risk, TER costs, liquidation tax). Goals (`/analitiche/obiettivi`) share the section header but are specified in 12-goals.

**Country gating (changed by web #465, `0.85.0`):** Analitiche is open in every product country. Where the country has no capital gains rules (`features.taxes` false: DE and OTHER) it runs **before tax** (ANA-036): positions carry no latent tax (`buildAnalyticsBase({ capitalGainsTax: false })`, server view `/api/analytics/base` since backend #482), the stamp duty is 0 (IT 0.2%, DE and OTHER 0) and the tax-only texts, cards and toggles are not shown. Previously (until 2026-10-21) DE was redirected to `/country-unavailable`.

## Entry points & navigation
- Main navigation item `Analitiche` (`/analitiche`).
- Section heading `Analitiche` with two views (on phone the title opens a views sheet): `Risposte` (`/analitiche`, `Quanto ti serve, quando ci arrivi, quanto dura`) and `Obiettivi` (`/analitiche/obiettivi`, `Per cosa metti da parte e quando ci arrivi`).
- Subtitle on Risposte: `Muovi le ipotesi e guarda cosa cambia. I numeri tecnici sono in «Per esperti».`
- Header button `Guida` reopens the walkthrough.
- Deep link `/analitiche?traguardo=1` (from Panoramica «Primi passi» step "Fissa il tuo traguardo") opens the «Il tuo traguardo» dialog once and removes the parameter; the walkthrough does not auto-open in that case.
- Legacy routes redirect to anchors: `/analitiche/costi` → `#costi`; `/analitiche/crescita` → `#dove-sono`; `/analitiche/prelievi`, `/rischio`, `/simulazione` → `#reggera`.
- Sidebar module «Obiettivo FIRE» (see 00-app-shell-navigation) summarises the same plan.
- Footer disclaimer: `Stime a scopo informativo basate su ipotesi tue, non previsioni né consulenza finanziaria o fiscale. Le regole fiscali sono semplificate: verificale prima di decisioni importanti.`

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** Heading «Risposte ⌄» (views Risposte / Obiettivi) with `Guida`; the headline
> figure and «tra 12,3 anni» share the baseline; «I tuoi dati di» + the shared `PeriodSelector` `12 mesi | 24 mesi | 📅` whose
> calendar sheet is the month grid (bounds: January ten years back → last complete month; same validation messages); the
> four answer tiles without icons and without rules.

### 0. Data loading & states
The page composes data from: saved assumptions (`GET /api/analytics/assumptions`), accounts, transactions for the selected data period (`type=tutte`), categories, investments overview (period `max`), pension funds, debts, net-worth snapshots (from 2000-01-01). All computations (plan, Monte Carlo with ~3,000 paths, costs, risk) run client-side.
- Loading: two skeleton blocks.
- Error: `Impossibile caricare i dati di Analitiche.` with retry.
- Walkthrough auto-opens on first visit (server flag `walkthroughSeen` false) once data is ready; closing (finished or dismissed) marks it seen (`POST /api/analytics/walkthrough`).

### 1. Walkthrough dialog (`Guida`) — 6 steps
1. `Quattro domande, una risposta ciascuna`; 2. `Quanta strada ho fatto?`; 3. `Quando posso smettere di lavorare?`; 4. `Il patrimonio reggerà?`; 5. `Quanto mi costa il portafoglio?`; 6. `Le ipotesi e «Per esperti»` — each with 1–2 short paragraphs (verbatim in `components/domain/analytics/walkthrough-steps.ts`). Navigation next/back, close at any step.

### 2. Headline
- Normal: `Puoi smettere di lavorare intorno al` + big year (current year + ceil(yearsToFire)); `tra {n anni}`; when sliders change the result, `{n anni} prima|dopo delle ipotesi salvate` (green if earlier, red if later).
- Already there: `Hai già raggiunto il numero FIRE` / `Già oggi`.
- Never within 80 years: `Oltre 80 anni`.
- No annual spending known: `Quando puoi smettere di lavorare` / `Mi serve la tua spesa annua` / `Registra almeno 3 mesi di movimenti oppure scrivila in «Tutte le ipotesi».`

### 3. Data period picker
- Label `I tuoi dati di` + segmented `12 mesi` (default) | `24 mesi` | `Scegli i mesi`; shows the actual range used (e.g. `gen 2025 – dic 2025`) or `Aggiorno le cifre…` while reloading; info hint `Risparmio, spesa e rendimento vengono dai tuoi movimenti e investimenti di questi mesi. Il mese in corso non conta perché non è finito. Una cifra scritta a mano resta la tua.`
- Choosing 12/24 saves immediately. `Scegli i mesi` shows `Da` / `A` month + year selects (last 10 years) and `Usa questi mesi`. Validation: end ≤ last complete month (`Il mese in corso non è finito: fermati al mese scorso.`), at least the minimum months (`Scegli almeno {n} mesi.`), at most 10 years (`Scegli al massimo 10 anni.`); button disabled if unchanged.
- Period is saved with assumptions and applies to the whole page.

### 4. "E se…" sliders (four, not saved until explicitly saved)
| Slider | Range | Step | Source note under slider |
|---|---|---|---|
| `Risparmio annuo` | 0 (or 2× negative baseline) … max(2×baseline, 12,000) | 100 | `Dai tuoi dati` (info: monthly average × 12, transfers excluded) or `Scritta a mano` + `Usa i tuoi dati ({importo})` |
| `Spesa annua` | 0 … max(2×baseline, 12,000) | 100 | same as above |
| `Rendimento reale` (glossary term) | −2% … 50% | 0.1% | `Dai tuoi dati` / `Valore prudente` / `Scritto a mano` + `Usa il tuo ({x}%)`; warning `Stima ottimistica` above 8% |
| `Tasso di prelievo` (glossary term) | 2% … 6% | 0.1% | `ipotesi di partenza` |
- If the baseline is unknown, the slider is replaced by `Non nota` with hint `Per calcolarla servono almeno 3 mesi di movimenti nel periodo scelto. Puoi scriverla in «Tutte le ipotesi».`
- When a slider is moved: delta text `{n anni} prima|dopo`, `stesso traguardo`, or `il traguardo supera gli 80 anni`. Moving back onto the baseline clears the override.
- Row below: `Altre ipotesi: volatilità {x}%, inflazione {y}%, imposte contate|non contate`, button `Tutte le ipotesi`; when any override is active: `Ripristina` and `Salva queste ipotesi` (`Salvo…`).

### 5. Four answer tabs (tab strip with a figure each; default selected `Arrivo`)
| Tab | Figure | Note |
|---|---|---|
| `Strada fatta` | progress % towards FIRE number (capped 999%) | `{patrimonio} su {numero FIRE}` |
| `Arrivo` | target year / `Già qui` / `—` | `ai ritmi attuali` or `con i valori dei cursori` |
| `Regge` | Monte Carlo success % for saved rule | `su {n} anni, smettendo oggi` or `serve la spesa annua` |
| `Costi` | annual portfolio cost | `{x}% l'anno` or `costo annuo` |

Below the strip, the selected question section (`Quanta strada ho fatto?`, `Quando posso smettere di lavorare?`, `Il patrimonio reggerà nel tempo?`, `Quanto mi costa tenere il portafoglio?`), each with a plain-language answer, a visual, and a collapsible `Per esperti · {hint}` panel:
- **Strada fatta**: progress bar, metrics `Il tuo patrimonio`, `Numero FIRE` (+ `{x} prima delle imposte` when latent tax counted), `Ti mancano`. Expert (`da dove arriva la crescita, mese per mese`): `Da dove arriva la crescita` — `Variazione del patrimonio`, `Dal tuo risparmio`, `Da mercato e altro`, monthly stacked bars; empty: `Servono almeno due mesi di storico del patrimonio e dei movimenti…`.
- **Arrivo**: sentence `Con {risparmio} risparmiati l'anno e un rendimento reale del {x}%, in euro di oggi.`; projected-wealth chart with FIRE-number reference line and dashed "saved assumptions" line when sliders differ. Missing spending → `Per stimare quando arrivi serve la tua spesa annua…`. Expert: `Il tuo numero FIRE` (Numero FIRE, Il tuo patrimonio, Anni al traguardo, lean FIRE sentence using only "Dovute" and "Saltuarie" spending groups), `Coast FIRE` (`Fra {n} anni` thresholds, `già raggiunto`), `Sensibilità alle ipotesi` grid (years to FIRE by return × withdrawal rate; `—` = >80 years, `ok` = reached; user's cell highlighted).
- **Regge**: headline with glossed terms, verdict sentence, optional better-rule sentence (`Cambiando il modo di prelevare … con la regola «…» il patrimonio regge nel {x}% dei casi.`), chips per rule with success % (≥90% positive, ≥75% neutral, else negative), compact fan chart `3.000 futuri possibili del tuo patrimonio`. Expert (`probabilità di successo, regole di prelievo, rischio del portafoglio`): `Probabilità che il patrimonio duri` with toggle `Smetto oggi` | `Smetto al traguardo FIRE`, metrics (`Probabilità di successo`, `Patrimonio finale (caso tipico)`, `Spesa annua`), percentile fan (10°/25°/50°/75°/90°); withdrawal-rules comparison (Fissa, Percentuale del patrimonio, Guyton-Klinger semplificata, Vanguard dinamica; `Fortunato (90°)`, `Tipico (mediana)`, `Sfortunato (10°)`); `Rischio del portafoglio` (Volatilità annua, Peggior calo, Sharpe, Sortino, Calmar, VaR 95% giorno, CVaR 95% giorno, Posizioni effettive; warning `Meno di un anno di dati: i numeri sono indicativi.`; observed vs assumed volatility note) and `Quanto ogni posizione pesa sul rischio` bars (risk share vs value weight; needs ≥2 positions with 60 common price days).
- **Costi**: sentences on annual cost, 30-year erosion and liquidation tax; metrics `Costo annuo`, `Persi in 30 anni`, `Imposte se vendessi tutto`. Expert (`costo di ogni fondo (TER), erosione, imposte`): `Costi del portafoglio` with metrics and an editable table per position (`Posizione`, `Valore`, `Costo annuo fondo (TER, %)` input placeholder `es. 0,20`, `Costo totale/anno`), validation 0–5% (`Costo di «{nome}»: inserisci un valore tra 0% e 5%.`), `Salva costi`; erosion chart `Senza costi` vs `Con i tuoi costi`; `Se vendessi tutto oggi` (Valore di mercato, Imposta sulle plusvalenze, Netto dopo le imposte) or `Nessuna plusvalenza non realizzata: nessuna imposta latente.` Empty: `Servono posizioni di investimento aperte per calcolare costi e imposte.`
- Each expert card may have an explainer (guided step-by-step reading, formula, limits). Glossary terms (e.g. `rendimento reale`, `euro di oggi`, `numero FIRE`, `TER`, `VaR`) open a popover definition.

### 6. «Tutte le ipotesi» dialog
Description `Quelle che cambi raramente. Si applicano a tutta la pagina e restano salvate.` Intro `Tutti i calcoli partono da queste ipotesi: sono tue assunzioni, non previsioni…`. Fields (each with explanatory hint):
- `Tasso di prelievo (%)` 1–10% (default 3.5%); `Rendimento reale atteso (%)` −2–50% (default 4%, auto from history by default; link `Usa il tuo rendimento ({x}%)`); `Volatilità annua (%)` 0–60% (default 12%); `Inflazione attesa (%)` −2–15% (default 2%).
- `Anni di pensione da coprire` integer 5–70 (default 40).
- `Spesa annua in pensione ({valuta})` and `Risparmio annuo ({valuta})`: empty = derived from data (placeholder `Dai tuoi dati`), 0–100,000,000.
- `Regola di prelievo`: `Fissa (stessa spesa ogni anno)` (default) | `Percentuale del patrimonio` | `Guyton-Klinger (semplificata)` | `Vanguard dinamica`.
- `Pensione pubblica attesa (facoltativa)`: annual amount + years after FIRE start; empty = ignored.
- Switches `Conta le imposte sulle plusvalenze` (default on; shows estimated latent tax) and `Includi la previdenza complementare` (default off; shows current pension value).
- Buttons `Salva ipotesi` (`Salvo…`), `Ripristina i valori consigliati` (resets form to defaults, keeps TERs; not saved until submit). Validation message `{campo}: inserisci un valore tra {min} e {max}.` / `Anni di pensione: inserisci un numero intero tra 5 e 70.`

### 7. «Il tuo traguardo» dialog
`Quanto ti serve in un anno` (placeholder `Per esempio 24.000`, prefilled with current spending), hint shows spending from data; live preview of target (spending ÷ withdrawal rate, net of tax setting) and arrival year sentence; buttons `Annulla` / `Salva il traguardo`. If the amount equals the data-derived spending it stays linked to data (saved as `null`). Error `Scrivi quanto ti serve in un anno, per esempio 24.000.`

## Requirements

#### Access & data
- **ANA-001** (changed by web #465) The app shall show Analytics in every product country where `capabilities.sections.analytics` is true (IT, DE, OTHER today) and show the country-unavailable message on a `403 country_feature_unavailable`. _API: `GET /api/analytics/base`_
- **ANA-002** The app shall load saved assumptions, the walkthrough-seen flag and the derived base data (accounts, transactions of the data period, categories, investments, pension funds, debts, net-worth history) before rendering answers. _API: `GET /api/analytics/assumptions`, `GET /api/accounts`, `GET /api/transactions?from=&to=&type=tutte`, `GET /api/categories`, `GET /api/investments/overview?period=max`, `GET /api/pension`, `GET /api/debts`, `GET /api/net-worth/snapshots?from=&to=`_
- **ANA-003** The app shall show a loading placeholder and an error state with retry for Analytics data.
- **ANA-004** The app shall show the informational disclaimer at the bottom of the Analytics view.

#### Walkthrough & goal entry
- **ANA-005** The app shall open the 6-step walkthrough automatically on the first visit and mark it seen when closed. _API: `POST /api/analytics/walkthrough`_
- **ANA-006** The app shall let the user reopen the walkthrough from a `Guida` button at any time.
- **ANA-007** The app shall open «Il tuo traguardo» when entered from the Primi passi goal link, without auto-opening the walkthrough.
- **ANA-008** The app shall let the user set the annual amount needed, preview the resulting FIRE number and arrival year, and save it as annual spending (linked to data when equal to the data-derived value). _API: `PUT /api/analytics/assumptions`_

#### Headline & period
- **ANA-009** The app shall display the year in which the user can stop working (or "already reached", "beyond 80 years", or a prompt for missing spending) and the time remaining.
- **ANA-010** The app shall show how many years earlier or later the slider scenario reaches the target compared with the saved assumptions.
- **ANA-011** The app shall let the user choose the data period (last 12 months — default, last 24 months, or a custom month range) and persist it. _API: `PUT /api/analytics/assumptions` (`dataPeriod`)_
- **ANA-012** The app shall validate a custom period: ending no later than the last complete month, at least the minimum number of months, at most 10 years.
- **ANA-013** The app shall exclude the current, incomplete month from data-derived figures and show the actual range used.

#### Sliders
- **ANA-014** The app shall provide four what-if sliders (annual savings, annual spending, real return, withdrawal rate) whose changes update headline, answers and charts immediately without saving.
- **ANA-015** The app shall show under each moved slider how many years earlier/later the target is reached.
- **ANA-016** The app shall label each of savings, spending and return with its source (from data, prudent value, or entered manually) and offer to return to the data-derived value. _API: `PUT /api/analytics/assumptions` (`annualSavings: null` / `annualSpending: null` / `expectedReturnAuto: true`)_
- **ANA-017** The app shall warn `Stima ottimistica` when the real return exceeds 8%.
- **ANA-018** The app shall replace a slider with "not known" guidance when its baseline cannot be derived (fewer than 3 months of transactions).
- **ANA-019** The app shall offer `Ripristina` to discard slider overrides and `Salva queste ipotesi` to persist them. _API: `PUT /api/analytics/assumptions`_

#### Answers
- **ANA-020** The app shall show four answer tabs (progress %, target year, Monte Carlo success %, annual cost) with a one-line note each, defaulting to the target-year tab.
- **ANA-021** The app shall show progress towards the FIRE number with current wealth, FIRE number (net of latent tax when enabled) and amount missing.
- **ANA-022** The app shall chart projected wealth up to the FIRE number, with the saved-assumption path dashed when sliders differ.
- **ANA-023** The app shall estimate the probability that wealth lasts for the configured retirement years via Monte Carlo simulation, for the saved rule and for each of the four withdrawal rules.
- **ANA-024** The app shall summarise annual portfolio cost (TER + stamp duty where applicable), 30-year erosion and tax due if everything were sold today.
- **ANA-025** The app shall show guidance instead of an answer when annual spending or investment positions are missing.

#### Expert details
- **ANA-026** The app shall provide, per question, a collapsible «Per esperti» panel collapsed by default.
- **ANA-027** The app shall show the monthly split of wealth change between savings and market/other when at least two months of history exist.
- **ANA-028** The app shall show FIRE number, lean-FIRE number (essential and occasional spending groups only), coast-FIRE thresholds and a sensitivity grid of years-to-FIRE by return and withdrawal rate.
- **ANA-029** The app shall show the Monte Carlo fan chart (10th–90th percentiles) with a toggle between retiring today and retiring at the FIRE target.
- **ANA-030** The app shall show portfolio risk metrics (volatility, max drawdown, Sharpe, Sortino, Calmar, daily VaR/CVaR 95%, effective positions) and per-position risk contribution versus value weight.
- **ANA-031** The app shall let the user enter a TER (0–5%) per open position and save all TERs together. _API: `PUT /api/analytics/assumptions` (`terByInstrument`)_
- **ANA-032** The app shall define glossary terms and explainers on demand when the user taps an underlined term or info icon.

#### Assumptions form
- **ANA-033** The app shall let the user edit withdrawal rate (1–10%), expected real return (−2–50%, or automatic from history), volatility (0–60%), inflation (−2–15%), retirement years (integer 5–70), annual spending and savings (empty = from data), withdrawal rule, optional public pension (annual amount and start delay), latent-tax inclusion and supplementary-pension inclusion. _API: `PUT /api/analytics/assumptions`_
- **ANA-034** The app shall offer `Ripristina i valori consigliati` restoring default assumptions (3.5%, 4% auto, 12%, 2%, 40 years, fixed rule, latent tax on, pension funds off) while keeping TERs, applied only on save.
- **ANA-035** The app shall redirect legacy Analytics sub-routes to the corresponding question anchor.
- **ANA-036** (web #465) Where `capabilities.features.taxes` is false (DE, OTHER) Analitiche shall run before tax: positions with tax rate 0 (also in the on-device plan, Monte Carlo and «e se…» simulations), no stamp duty (costs at the country's rate, 0 outside Italy; `CostSummary.stampDuty` false); question 4 says `Costi dei fondi: {0} l'anno ({1} del portafoglio).` / `Costi dei fondi: {0} l'anno.` and never the «Vendendo tutto oggi…» sentence; the `Imposte se vendessi tutto` metric, the `Se vendessi tutto oggi` card and the `Conta le imposte sulle plusvalenze` toggle are hidden; the TER note is `Il TER lo trovi nel KID/scheda del fondo (per un ETF globale di solito 0,1-0,4%).`; the sliders' summary is `Altre ipotesi: volatilità {0}, inflazione {1}`.

## Mobile adaptation notes
- **Proposal — needs product sign-off:** Order on phone: headline → data-period picker → sliders (stacked, full width) → answer tabs as a 2×2 grid of figure tiles → selected question → «Per esperti» disclosure. Selecting a tile scrolls to its section.
- **Proposal — needs product sign-off:** Slider override actions (`Ripristina`, `Salva queste ipotesi`) appear in a sticky bottom bar only while overrides exist, so they remain reachable after scrolling.
- **Proposal — needs product sign-off:** Glossary terms and info hints open a bottom sheet (not a hover/popover); chart tooltips become press-and-hold scrubbing with values in a fixed header.
- **Proposal — needs product sign-off:** The sensitivity grid, TER table and risk-contribution table become vertically stacked cards (one per row/position); the sensitivity grid may scroll horizontally inside its card with the user's cell centred on open.
- **Proposal — needs product sign-off:** Custom data period uses a native month-year picker for `Da` and `A`.
- **Proposal — needs product sign-off:** Monte Carlo (≈3,000 paths) and plan computations run off the main thread on both platforms with the same seed and algorithm, or (preferred) move to a server endpoint so both apps and web return identical numbers.
- **Proposal — needs product sign-off:** «Tutte le ipotesi» opens as a full-screen form with a sticky save button.

## Mobile implementation notes (Phase 4a, 2026-10-19)
- Data: one `GET /api/analytics/base?today=` (G9); the plan, sliders, sensitivity, costs and Monte Carlo are recomputed on the device from `base` with the ported FireCalc / FirePlanning / MonteCarlo / CostsCalc (decision 0002). Monte Carlo runs off the main thread (seed 1, 3,000 paths; Android runs the four rules on parallel workers, results identical to `compareRules`).
- Layout follows the phone proposal: headline → period → stacked sliders → 2×2 answer tiles → selected question → «Per esperti». The slider actions stay inline under the sliders (no sticky bar); glossary terms and info hints open a bottom sheet; «Tutte le ipotesi» is a full-screen form; sensitivity grids scroll horizontally; the rules table and TER table are stacked rows.
- Legacy sub-routes and `#anchors` select the matching answer tile (open question 5). Since web #465 Analitiche is open for DE and OTHER too, before tax (ANA-036).
- Not built yet: the «Guida passo passo» numbered readings at the top of each expert panel (`guided-steps.ts`, long-form generated text, open question 7).

## Open questions
1. All analytics computations (plan, Monte Carlo, risk, costs, historical return, coast FIRE) are client-side TypeScript fed by 8 separate queries; mobile parity requires either a shared server computation endpoint or identical ports in Swift and Kotlin — and Monte Carlo randomness must be seeded to match. Which approach?
2. Transactions for up to 10 years are fetched to derive spending/savings; this is heavy on mobile networks. Should the server provide aggregated monthly cashflow instead?
3. `deltaText` and headline comparison strings (`prima`/`dopo`, `il traguardo supera gli 80 anni`) and some metric sub-labels are hard-coded Italian outside `t()`; the goal dialog prefills using `it-IT` grouping regardless of language.
4. Slider money ranges are absolute (min ceiling 12,000, step 100) regardless of currency.
5. Legacy anchors (`#costi`, `#reggera`, `#dove-sono`) are section ids but answers are now tabs: does the web actually select the right tab from the hash? Define deep-link behaviour for mobile (proposal: deep link selects the tab).
6. Should the «Obiettivo FIRE» sidebar module (`/api/sidebar/fire`) exist on mobile (no sidebar)? Possibly as a Panoramica card.
7. Explainer texts and the glossary are long-form Italian content; confirm translation coverage before mobile release.
