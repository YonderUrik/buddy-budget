# Parity matrix

Status per feature area. Update in the same PR that changes a status.
Legend: ⬜ not started · 🟨 in progress · ✅ done · ➖ not applicable

| Area | Prefix | Reqs | Phase | Spec | Backend ready | iOS | Android |
|---|---|---:|---:|---|---|---|---|
| [App shell & navigation](features/00-app-shell-navigation.md) | `SHELL` | 57 | 1 | draft | 🟨³ | 🟨³ | 🟨³ |
| [Authentication & Onboarding](features/01-auth-onboarding.md) | `AUTH` | 57 | 1 | draft | 🟨³ | 🟨³ | 🟨³ |
| [Overview (Panoramica)](features/02-overview.md) | `OV` | 43 | 2 | draft | ✅ | 🟨⁵ | 🟨⁵ |
| [Transactions — Liquidità · Movimenti & Analisi](features/03-transactions.md) | `TX` | 63 | 2 | draft | 🟨⁵ | 🟨⁵ | 🟨⁵ |
| [Accounts & Bank Sync — Liquidità · Conti](features/04-accounts-bank-sync.md) | `ACC` | 55 | 2 | draft | ✅ | 🟨⁶ | 🟨⁶ |
| [Categories & Categorization](features/05-categories-categorization.md) | `CAT` | 96 | 2 | draft | 🟨⁵ | 🟨⁵ | 🟨⁵ |
| [Subscriptions (Abbonamenti)](features/06-subscriptions.md) | `SUB` | 26 | 2 | draft | ✅ | 🟨⁷ | 🟨⁷ |
| [Investments (Investimenti)](features/07-investments.md) | `INV` | 110 | 3 | draft | ✅ | 🟨⁸ | 🟨⁸ |
| [Securities & watchlist (Titoli)](features/08-securities-watchlist.md) | `SEC` | 53 | 3 | draft | ✅ | 🟨⁸ | 🟨⁸ |
| [Pension (Pensione — Italian supplementary pension funds & TFR)](features/09-pension.md) | `PEN` | 28 | 3 | draft | ✅ | 🟨⁹ | 🟨⁹ |
| [Debts (Debiti)](features/10-debts.md) | `DEBT` | 38 | 3 | draft | ✅ | ✅⁹ | ✅⁹ |
| [Analytics (Analitiche — "Risposte" / FIRE planning)](features/11-analytics.md) | `ANA` | 35 | 4 | draft | ✅ | 🟨¹⁰ | 🟨¹⁰ |
| [Savings goals (Obiettivi)](features/12-goals.md) | `GOAL` | 35 | 4 | draft | ✅ | ✅¹⁰ | ✅¹⁰ |
| [German financial planning (Planung DE)](features/13-planning-de.md) | `PLAN` | 31¹¹ | 4 | draft | ✅ | ✅¹² | ✅¹² |
| [Imports (personal CSV / Excel)](features/14-imports.md) | `IMP` | 61 | 4 | draft | 🟨¹³ | 🟨¹³ | 🟨¹³ |
| [Settings](features/15-settings.md) | `SET` | 49 | 1 | draft | 🟨³ | 🟨³ | 🟨³ |
| [Help & support](features/16-help-support.md) | `SUP` | 26 | 4 | draft | ✅ | ✅¹⁴ | ✅¹⁴ |

## Foundations (Phase 0)
| Item | Spec | iOS | Android |
|---|---|---|---|
| API client + health check | ✅ | 🟨 | 🟨 |
| Session store + bearer auth | ✅ | ✅⁴ | ✅⁴ |
| `BBFormat` (formatting vectors) | ✅ | ✅¹ | ✅¹ |
| Generated strings | draft | 🟨 | 🟨 |
| Generated design tokens + fonts | ✅ | 🟨 | 🟨 |
| Design system v1 | draft | 🟨² | 🟨² |

¹ 190/194 `formatting.json` vectors pass on both platforms, plus the period/date/`parseAmount` helpers in 10 other vector files. The 4 en/de `translate` vectors need the generated string catalog (`L10n.translate`); they are tracked under "Generated strings".

² Built on both platforms with the same names and parameters (`DesignSystem/Components/*` · `designsystem/components/*`):
BBScreen, BBCard(+Header), BBSection, BBSeparator, BBIconButton, AmountText, MoneyHero, BBBadge, ManualBadge,
AutoOriginBadge, BBChip, BBButton, BBTextField, BBSwitch, BBSlider, SegmentedControl, BBListRow, BBAvatar,
BBSwipeToDelete (+ `ToastCenter.showUndo`, decision 0003), EmptyState, LoadError, PageError, BBSkeleton(+Rows/Page),
MerchantLogo + LogoCredit (`LogoLoader` with bearer auth), BBSheet, BBAlertSheet, ToastCenter/BBToastView, StatCard,
ProgressBar, Sparkline, BBLineChart (iOS Swift Charts, Android Canvas; scrub per charts.md §1), BBDonut, BBIconView
(188 Lucide icons via `scripts/gen-icons.mjs`). Shared logic with tests in BuddyBudgetKit / `:core`: `AmountDisplay`
(tone/mask/hero split), `AmountInput`, `ChartScale` (Recharts nice ticks, hero domain, scrub, tooltip clamp),
`ChartPaths` (d3 monotone, smooth, stepAfter), `DonutGeometry`, `SparklineGeometry`, `MerchantInitial`, `LogoLoader`.
DEBUG-only component gallery: iOS launch argument `-BBGallery <page>`, Android intent extra `--ei bbGallery <page>`.
Not yet: snapshot tests, TextMorph/AnimatedNumber, BBCheckbox, BBSelect/BBMenu/BBPopover, FormDialog, other charts.

³ Phase 1 (2026-10-18), same screens on both platforms, verified against the local dev server with a real email-code
sign-in. **Done:** launch routing on `GET /api/me/bootstrap` `gate` (login → deactivated → legal → onboarding → shell,
SHELL-001…004, AUTH-017…023; 401 → login, gate 403 → re-fetch), email-code login with resend countdown and
`INVALID_OTP`/`OTP_EXPIRED`/`TOO_MANY_ATTEMPTS`/429 mapped to catalog strings, signed-out language picker, foot links,
onboarding (5 steps incl. category proposal + «Personalizza», AI consent, notifications + inbox preview, legal
declarations; language/country switch re-renders and resets categories), legal re-acceptance (+ ZIP export via share
sheet), deactivated/reactivate, bottom bar Panoramica/Liquidità/Investimenti/Debiti/Altro with uncategorised badge,
«Altro» as fifth-tab root (account row, other sections country-gated, Impostazioni, Aiuto, hide amounts, Esci, legal
links, `v{version} ({build})`), country-unavailable screen, route registry with placeholders for unbuilt areas, all
five Settings groups (profile, sessions + revoke, currency, home page, theme, country/language, notifications,
AI assistant, legal documents, GDPR mailto requests, data summary + export, reset/deactivate/delete with typed
confirmations and an in-app **email-code re-auth** panel). Tests named after IDs in `ShellAuthSettingsTests` /
`ShellAuthSettingsTest`. **Deferred:** Google/Apple sign-in and «Collega Google» (decision 0003, backend R3/R4);
«Il tuo quadro» / sidebar insights (SHELL-028…038, with Overview in Phase 2); sync island (SHELL-039…047, with bank
linking, needs R6); demo banner and «Novità» (SHELL-048…050, Phase 2 Overview); section transition animation (SHELL-027), skeleton/error page per feature screen (SHELL-054/055, per feature);
«Barra laterale» and analytics opt-out (web-only per the mobile notes, SET-020…022, SET-034); unsubscribe page
(web-only, AUTH-053…057); magic link (replaced by email code, AUTH-001…006 adapted). Mobile implements the correct
"customised" check for categories in en/de (web compares with the Italian proposal). Backend gaps: N2 (native
User-Agent shown as «Browser sconosciuto su …» in Sessions), no endpoint for the onboarding category proposal (ported
from `lib/categories/defaults.ts`), recent-login window makes export/reset/delete always need the in-app code re-auth.

⁴ `SessionStore` interface in BuddyBudgetKit / `:core` (in-memory twin for tests); adapters in the apps: iOS
`KeychainSessionStore` (AfterFirstUnlockThisDeviceOnly; DEBUG simulator fallback for unsigned builds), Android
`KeystoreSessionStore` (AES-GCM key in AndroidKeyStore). `APIClient`/`ApiClient` send `Authorization: Bearer <token
verbatim>`, no cookies, native User-Agent and `Accept-Language`; typed `APIError`/`ApiError` with `APIErrorCode`
(`api/README.md` §5 + better-auth OTP codes); fixtures `auth-email-otp.json`, `me-bootstrap.json`, `errors.json`.
DEBUG launch hooks for verification: iOS `-BBSignOut -BBToken -BBEmail -BBAutoSend -BBCode -BBTheme -BBLanguage -BBOpen
-BBOnboarding`, Android extras `bbSignOut bbToken bbEmail bbAutoSend bbCode bbTheme bbLanguage bbOpen`.

Per-requirement status lives in the test names of each app (`<ID>_…`); a script will
cross-check both repos against `features/` once Phase 0 tooling lands.

## Domain ports

Client-side calculations ported 1:1 from the web (domain/README.md §2, **PORT** rows), with the same function names
on both platforms. The iOS code lives in `BuddyBudgetKit/Sources/BuddyBudgetKit/Domain/<Topic>/` and the Android code in
`core/src/main/kotlin/io/buddybudget/core/domain/<topic>/`. The vector adapters are `VectorAdapters+<Topic>.swift` and
`<Topic>VectorAdapters.kt`. Every vector file is in the harness. An unknown function name fails the run. A function
that stays on the server is listed in `serverSide` (`VectorAdapters.swift` and `VectorSuite.kt`, same list on both
platforms) together with the endpoint that replaces it.

| Vector file | Passed (iOS = Android) | Server-side | Ported (namespace) | Server-side → endpoint |
|---|---:|---:|---|---|
| formatting.json | 190 | — | BBFormat | 4 en/de `translate` skipped: they need the generated catalog (`L10n.translate`) |
| expenses.json | 41 | 14 | Periods, `MovementList.filterTransactions` | compute* → `GET /api/liquidity/month`, `/analysis` |
| cashflow.json | 10 | 13 | Periods | compute* → `GET /api/liquidity/analysis` |
| liquidity.json | 35 | 3 | `SplitShare` (Dividi), `MovementList.groupByDay`, `ConnectionHealth`, dayLabel | `buildCumulativeSpend` → `/api/liquidity/month` (pace); `buildAccountBalanceSeries` → `GET /api/accounts?include=trend` |
| net-worth.json | 11 | 4 | `NetWorthToggles` (exclude/restrict classes, change) | `deriveLiquidityHistory` → server cron; `buildNetWorthSeries` → `GET /api/overview` |
| debts.json | 82 | 3 | `DebtCalc`: amortization, solvers, TAEG, add form, `buildLoanPlan`, early repayment, recurring extra, refinance, payoff strategies, `visibleRowRange`, `rankInstallmentCandidates` | `buildDebtsView` → `GET /api/debts`; `yearlyInterestShares`, `buildExitPlan` → `GET /api/debts?include=insights` |
| pension.json | 25 | 15 | `PensionCalc`: `exitTaxRate`, `exitTaxMilestones`, `withdrawalScenarios`, `projectPension` | contributions, performance, TFR, recent quarterly, yearly breakdown → `GET /api/pension/view` |
| goals.json | 9 | 8 | `GoalWizard` (emergencyTarget, requiredMonthly, wizard step helpers) | `buildGoalsPlan`, `buildGoalsView`, `monthsToFire` → `GET /api/goals` |
| fire-and-simulations.json | 78 | 2 | `FireCalc`, `MonteCarlo` (bit-exact mulberry32), `FirePlanning` (resolvePlan, scenario sliders, sensitivity), `CostsCalc` | `resolveAssumptions`, `mergeAssumptions` → `GET/PATCH /api/analytics/assumptions` |
| costs.json | 4 | 3 | `CostsCalc.summarizeCosts`, `costDrag` | cost impact, reinvestment → `GET /api/investments/view` |
| exposure.json | 4 | 10 | `AllocationTargets` (`analyzeAllocation`, `suggestContribution`, `isCompleteTarget`) | exposure → `GET /api/investments/view`; overlap → `GET /api/instruments/{id}/analysis` |
| financial-planning-de.json | 52 | 0 | `GermanPlanning` (all editor maths) | (`germanIncomeForecast` has no vectors → `GET /api/financial-planning?include=results`) |
| subscriptions.json | 10 | 8 | `SubscriptionCalc.monthlyEquivalent`, `nextChargeDate` | detection, view → `GET /api/subscriptions` |
| italian-taxes.json | 2 | 33 | (shiftMonths) | `GET /api/investments/taxes`, `POST …/taxes/simulate-sale`, `GET /api/investments/income` |
| returns.json | 3 | 23 | (daysBetween, isoWeek) | `GET /api/investments/performance` |
| investments.json, fx.json | 0 | 16, 6 | — | `GET /api/investments/view` |
| risk.json | 0 | 22 | — | `GET /api/investments/view`, `/performance`; title stats → `GET /api/instruments/{id}/analysis` |
| month-pace.json, overview-voice.json | 0 | 4, 4 | — | `GET /api/overview`, `GET /api/liquidity/month` |
| category-colors.json | 0 | 2 | — | `POST /api/categories/distribute-colors` |

Further helpers without vectors, unit-tested from the web's own tests: `CategoryLegend` (budget saturation, legend
sort), `DebtCalc.rankInstallmentCandidates` / `describeFilterUsage`, `GoalWizard` step validation, `MonteCarlo.compareRules`
running off the main thread.

Known vector-input gaps, handled in the adapters (the vectors themselves are unchanged):
- `resolveAddForm+previewAddForm` has no `today`, so the adapters use the generator's date.
- `germanAvdAllowance-indirect` leaves out `kind`.
- Several fire, exposure and net-worth inputs refer to another vector's output or to a generator fixture by name.
- A few `runMonteCarlo` and `resolvePlan` vectors pin only a subset of the output, so the adapter projects the same keys.

⁵ Phase 2 stream b: Movimenti (paged feed, filters, month view, movement actions, add form), Analisi, Categorie e regole and
Categorizza (deck, «Messe dall'app», AI polling, Ricategorizza) on both platforms. Deferred: Liquidità hero chart and its
period selector (TX-009…011, needs the net-worth snapshots view), legacy path redirects (TX-005), import entries
(`Importa da CSV o Excel`, `Importa un file`; imports are Phase 4), the Categorizza tour (CAT-069), the wide-screen list
view (CAT-070…075, phone only), the server-side rules (TX-032/033/037/040/047, TX-063, CAT-002/020/022/024/031/032/
033/043/044/076/085 — backend behaviour, not client work).

⁵ Phase 2 stream a (branch `feat/phase2-a`): Overview on both platforms from `GET /api/overview` (OV-001…042; OV-003/004/010/011
computed by the server), «Primi passi», demo offer/banner/reset (SHELL-048, OV-039…042), «Novità» chip + sheet (SHELL-049/050),
«Il tuo quadro» in «Altro» (SHELL-020, 028…038) with per-device module switches (SET-020/021). Open: OV-043 is handled by each
creating screen (Conti done; transactions with 03); links to unbuilt areas (goals, debts, investments, pension) open placeholders.

⁶ Phase 2 stream a: Conti list (server trend/health/status), renewal banner, new-account sheet (capacity, manual 2-step form,
bank picker), native R6 bank link (ASWebAuthenticationSession / Custom Tabs, `buddybudget://bank/return`, `/complete`, «Conti
trovati», finalize) — verified up to the local 502 (placeholder GoCardless credentials), rest covered by unit tests on
`gocardless-native-flow.json`; account detail, sync box, delete/unlink with copy that names the movements (decision 0003), sync
job cards with 1 s polling. Server-only: ACC-015, 045, 052…055. Open: the global sync «island» (SHELL-039…047).

⁷ Phase 2 stream a: SUB-001…026 on both platforms (fixture `api/fixtures/subscriptions.json`, dev user, 2026-10-18); Elimina /
Ripristina use the 5 s undo (decision 0003). «Segnala questo problema» under the add-form error: Phase 4d, see ¹⁴.

⁸ Phase 3a: Investimenti on both platforms from `GET /api/investments/view|performance|income|taxes` — Portafoglio, Performance
(per-day returns chart with inspect lookup, risk card, heatmap, benchmark), Diversificazione (composition, targets + next
contribution), Dividendi, Tasse (IT only: sale simulator, carry-forwards, statements; DE gets a placeholder until 13-planning-de),
Operazioni (add/edit/delete with buy/sell validation), costs with reinvest toggles; Titoli: search, security page (price chart,
analysis, alerts, manual prices, quotation link, commentary, settings), watchlist. Verified with the IT and DE dev users
(2026-10-19). Broker imports and «Importazioni» (INV-001 import actions, INV-092…110): Phase 4c, see ¹³. Open: drag range selection on
the chart (INV-035; «Personalizzato» works), world map / full correlation matrix / overlap Venn, brand logos (initials + server
logo). Backend: demo instruments stay `backfilling: true` and have no fundamentals.

⁹ Phase 3b (2026-10-19), same screens on both platforms, verified against the dev server with the IT demo user and the DE user
(Pensione hidden from «Altro», `/pensione` → country-unavailable; Debiti in German). **Debiti (DEBT-001…038):** one
`GET /api/debts?include=insights` for overview and detail; hero, «Prossime rate» with pay-from-overview, «I tuoi debiti»,
«Come uscirne prima» (slider indexes the server's exit plans), «Dove paghi di più»; loan detail with chips, ring/facts, pending
banner + bulk pay, «E se…» (extra slider via `simulatePayoff`, surroga via `compareRefinance`, one-off → early-repayment dialog),
events (swipe/bin delete with Undo, decision 0003), plan (2 past + 8 next, «Mostra tutte»); add flow (start mode, name/date,
solver of the missing figure with notice, costs + preview/TAEG), pay installment with the ±20-day transaction picker, rate change,
balance correction, early repayment (once with the two alternatives + register, monthly simulation-only), delete with
confirmation; overflow «⋯» for Cambio tasso / Correggi residuo / Elimina; deep links incl. the legacy simulator (DEBT-038).
No rename/costs editing (decision 0003). **Pensione:** `GET /api/pension/view` per fund; fund chips, five tabs, disclaimer;
Panoramica (hero + chart + insights), Andamento (chart, yearly stacked bars, best/worst), Scenari (withdrawal ranges, TFR
comparison, exit-tax timeline with draggable chip indexing `exitTax.timeline`, «Torna a oggi»), Proiezione (sliders on
`projectPension`), I tuoi dati (snapshot form/list with Undo delete, fund profile edit/delete with confirmation, add another
fund), empty state with the two-step add-fund form. Import (PEN-014…017): File → Colonne → Riepilogo, parsed on the device
with the ported `readCsvTable`/mapping/`planSnapshotImport`; Phase 4c added the file picker (CSV/TXT/XLSX via `ImportXlsx`)
and the downloadable template through the share sheet (PEN-018), see ¹³. «Segnala questo problema» on the add-fund error: Phase 4d, see ¹⁴. Backend: demo
payment events have `amount: null`, so the plan still counts those installments as «Da confermare» while the log says
«Rata N pagata».

¹⁰ Phase 4a (2026-10-19), same screens on both platforms, verified against the dev server with the IT demo user and the DE
user (Analitiche hidden from «Altro»; `/analitiche` and `/analitiche/obiettivi[/{id}]` → country-unavailable, as on the web where `retirement` is switched off, `isCountryPathAvailable`).
**Analitiche (ANA-001…035):** one `GET /api/analytics/base?today=`; headline with year/«Già oggi»/«Oltre 80 anni»/missing
spending and the comparison with the saved plan; data period 12/24/custom (month + year selects, validation, actual range,
«Aggiorno le cifre…»); four «e se…» sliders with deltas, source notes («Dai tuoi dati» + info, «Scritta a mano» + «Usa i tuoi
dati», return source + «Usa il tuo», «Stima ottimistica»), «Non nota»; «Ripristina» / «Salva queste ipotesi»; 2×2 answer
tiles; Strada fatta (sentences, progress, metrics; expert growth split with stacked bars), Arrivo (timeline chart with FIRE
line and dashed saved path; expert FIRE number, lean FIRE, coast FIRE, two sensitivity grids), Regge (Monte Carlo over the four
rules off the main thread, verdict, better rule, chips, fan chart; expert simulation with «Smetto oggi | al traguardo FIRE»,
rules comparison + spending chart, portfolio risk + risk contribution), Costi (sentences, metrics; expert TER inputs 0–5 % saved
together, erosion chart, liquidation); glossary terms (dotted underline → bottom sheet) and explainers; walkthrough (auto on
first visit, `POST /api/analytics/walkthrough`, «Guida»); «Tutte le ipotesi» full-screen form with validation and «Ripristina i
valori consigliati»; «Il tuo traguardo» (`?traguardo=1`, data-linked when equal); legacy sub-routes select the answer.
Tests `ANA0xx_…` in `AnalyticsGoalsTests` / `AnalyticsGoalsTest` (49 each, analytics-base.json + goals.json; the plan,
journey sentences and timeline equal the server's). **Not built:** the numbered «Guida passo passo» readings inside the
expert panels (`guided-steps.ts`, ~40 generated paragraphs; ANA-032 covers glossary and explainers). Monte Carlo is slow on
the debug emulator (≈5 s, instant on the simulator); a server endpoint would remove the cost (open question 1). Phase 4b fix:
while the compare runs the «Regge» tile shows a loading placeholder on both platforms («serve la spesa annua» only when the
spending is really missing); a run in progress is no longer restarted for the same input, superseded runs stop at the next
path (cooperative cancellation), the four rules run in parallel, and the Android skeleton pulse no longer recomposes per frame.
The remaining slowness is the debug build on a 1-vCPU emulator (interpreted code, host swapping), not the algorithm.
**Obiettivi (GOAL-001…035):** `GET /api/goals` reused for 5 minutes, refetched after every mutation; empty state + emergency
suggestion; capacity header (three states) with the allocation bar (tap → segment sheet); priority list with status, pace and
FIRE-shift sentences, source chips and up/down reorder (optimistic, full order, 409 → message + refetch); «Smettere di
lavorare» row → Risposte; «La strada»; «Raggiunti»; 5-step full-screen form (kinds, default names, emergency 3/6/12 months,
native month grid, sources with proposals and editable parts, own parts counted as free on edit, pace shortcuts, position,
summary, «Ricordamelo per email» enabled after a successful create); detail with grouped sources (tax, short), «Cosa cambia
quando lo raggiungi», «Aggiorna i soldi da parte» (form at fonti), «Modifica», «Segna come raggiunto» / «Riapri», «Elimina» with
confirmation (decision 0003) and «Obiettivo non trovato»; masked amounts; GOAL-035 (reminder toggle) from Phase 1 Settings.
Fixture `api/fixtures/goals.json` added (copied into the apps' test fixtures until the submodule is bumped).

¹¹ PLAN-032…039 (German pensions, AVD, retirement, simulators) are out of scope: hidden on the web today (decision 0004). In scope: PLAN-001…031, Tax and Income screens only.

¹² Phase 4b (2026-10-19), verified against the dev server with the DE user (and the IT user, whose Tasse/Dividendi stay
Italian). For DE the Investimenti `Tasse` / `Dividendi` tabs are the German Tax and Income screens; subpaths of both go to
the country-unavailable screen (PLAN-003). Thin client (ADR 0002): `GET /api/financial-planning?include=results` for the plan,
revision and the saved plan's results; `POST /api/financial-planning/results` (debounced 400 ms, valid plans only) for the
results of the edited tax profile; `GET /api/investments/overview?period=1mese` only for instrument names and fund-sale dates
(`period` only bounds prices; instruments and operations are complete). The plan stays a verbatim JSON tree (hidden sections and
`futureForecast` kept, PLAN-014/031); full client validation = port of `germanPlanSchema` (cases checked against zod);
numeric fields clamp as typed, empty = 0, helper `Min. {0}`. Mobile adaptations adopted (decision 0003): bottom save bar
(status + `Save plan`, save errors and the validation message shown in the bar, 409 with `Reload` + confirmation),
unsaved-changes sheet when leaving `Tasse` (other tab or back: Save / Discard / Cancel), native picker sheets, decimal keypad,
disclosure rows, forecast payments as cards, source links in the browser, loading skeletons instead of `Loading…`, dates as
`d MMM y`. Income always shows the saved plan's results. Tests `PLAN0xx_…` in `PlanningDEScreensTests` (22) /
`PlanningDEScreensTest` (22) on financial-planning-results*.json plus a trimmed overview fixture in the apps' test fixtures.

¹³ Phase 4c (2026-10-19), same screens on both platforms, verified against the dev server (`mobile-dev@buddybudget.test`,
with `pnpm worker:csv` running): a real personal CSV (`imports/banca-prova.csv`; iOS: AI review → «Rianalizza» → 6 movements;
Android: picked with SAF and, a second time, opened from the Files app, reusing the saved «Banca Prova» format) and a real
DEGIRO statement imported on each platform, then deleted again with «Importazioni» › «Elimina». Pension (PEN-014): an
`.xlsx` read on the device through SAF into the Colonne step.
**`/importazioni` (IMP-001…048, IMP-055…060):** one scrolling page as on the web (report, 3-step form, «Le tue
importazioni»); `GET /api/personal-imports` polled every 3 s only while a job runs and only in the foreground; receipt with
stages and estimate; «Righe da controllare» (reasons, «Importa e salta», «Rianalizza con l'AI», tabs of all rows, 25 per
page); XLSX → CSV on the device (`ImportXlsx`, golden-checked against the web's `readXlsx` + `gridToCsv`); global island
above the bottom bar with device-local dismissals (last 50); data reload when a job finishes. **Correction (IMP-049…054):**
built against the web `main` contract, **not verifiable** on the backend branch (see api/gaps.md G17). **Broker imports
(INV-001, INV-092…105):** header actions «Importazioni fatte» / «Importa» / «Registra»; wizard File → Anteprima →
Strumenti → Conferma; IBKR/DEGIRO/Trade Republic parsed by the server, generic/Yahoo/Fineco (`.xlsx`) read on the device
with the ported rules (golden vectors `fixtures/imports/import-rules-vectors.json`), mapping remembered per header set
on the device; DEGIRO destination portfolio; multi-file batch (IBKR first) with progress; AI recovery only with consent.
**«Importazioni» (INV-106…110):** grouped history, broker and personal deletion with the what-goes/what-stays confirmation
(decision 0003), full reset with the typed literal and conflict refresh. Files come from the system picker (iOS
`fileImporter`, Android SAF) or are shared to the app (iOS document types / «Apri in», Android `SEND`/`SEND_MULTIPLE`/`VIEW`
filters) and routed to the broker wizard when the content is a supported broker export, else to the personal form; links
`/importazioni?job=` open the job (in-app paths, `buddybudget://importazioni`, `https://buddybudget.io/importazioni`
pending App Links / universal-link verification, G17). Liquidità entry points (TX-002 «Importa da CSV o Excel», 2d link,
TX-022 «Importa un file») now open the screen. Tests `IMP0xx_…`, `INV09x/10x_…`, `PEN014/018_…` in `ImportsTests` /
`ImportsTest` (37 each). «Segnala questo problema» links: Phase 4d, see ¹⁴. **Not built:** provider logos (initials
badges), the email itself (server). Backend: G17 (branch behind web `main` for corrections and `brokerFallback`).

¹⁴ Phase 4d (2026-10-19), same screens on both platforms, verified against the dev server with the IT, EN and DE users.
**Aiuto e segnalazioni (`/aiuto`, SUP-001…018):** from «Altro» › Assistenza; subtitle and service-status link; Scrivici
form (kind segmented control with per-kind placeholder, message 10…4000 after trimming, sensitive-data hint, technical
context checkbox `pagina … versione ios|android-<version> (<build>), schermo WxH (points / dp), tema Chiaro|Scuro`, «Invio…»,
thank-you box with the selectable `SUP-XXXXXX`, «Scrivi un'altra segnalazione», error = server text + `Puoi anche scrivere a
support@buddybudget.io.` with the message kept); Risposte rapide (five independent accordions); Su GitHub (four links,
prefilled issue identical to the web's `URLSearchParams`, GitHub mark as a brand asset). Deep link `/aiuto?da=&tipo=`
(SUP-002/003; the mobile apps have no user menu, so `?da=` arrives only through links). **Quick-report sheet
(SUP-019…023):** «Scrivici» speech-bubble icon in the top bar of the five tab roots (SHELL-023, mobile note), `Segnala`
action on error toasts (`ToastCenter.showError(message, area)`) at the web's `errorToast` call sites (Categorizza,
recategorize/undo, movement category, debts, operations, income dismissal, tax regime, bank sync), `Segnala questo
problema` through the shared components — `LoadError` (area `caricamento`, every load error), `BBErrorBox(reportArea:)`
and `ErrorWithReport` (add debt/goal/subscription/movement/account/pension fund/operation, bank linking and the bank list,
personal-import receipt/review/upload, broker import notices via `ImportNotice(report:)`, finished sync-job card with errors
= SHELL-046's report). Every opening starts empty; dismissing discards. Links are hidden outside the signed-in shell, as on
the web. Context path = the logical web path of the visible screen (`ShellModel.currentPath`). **Crash reporting
(SUP-024/025):** native mapping of «screen failed to render» = a response the screen cannot decode; the API client's
decoding hook sends `POST /api/client-errors {kind: sezione, area: <first path segment>, name: DecodingError, message:
"Risposta non leggibile: /api/<resource>"}` once per run, silently. SUP-016/017/026 are server behaviour (covered by the
fixture tests). Tests `SUP0xx_…` in `SupportTests` / `SupportTest` (19 each) on `api/fixtures/support.json`. A real submit
from each app reached the server with the right kind and source (the local placeholder Resend key answers 502, so no email
left the machine). Also fixed here: `gen-icons.mjs` dropped `<line>` coordinates (`x1`, `y2` …), so nine icons (circle-alert,
credit-card, calculator, dollar-sign, gamepad-2, link-2-off, monitor, percent, smile) were missing strokes on both
platforms; iOS `BBTextArea` placeholder no longer truncates; iOS bottom sheets now move above the keyboard. Not built: a
`globale` crash report on next launch (app crashes; proposal open), the sidebar «Scrivici» (no sidebar on phone).
