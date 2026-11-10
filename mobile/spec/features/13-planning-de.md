# German financial planning (Planung DE)
Status: draft · Source: `components/domain/financial-planning/*` (`planning-screen.tsx`, `fields.tsx`, `tax-editor.tsx`, `income-view.tsx`, `sale-simulator.tsx`, `crypto-editor.tsx`, `pension-editor.tsx`, `pension-net-editor.tsx`, `avd-editor.tsx`, `retirement-editor.tsx`), `lib/financial-planning/*` (`schema.ts`, `registry.ts`, `portfolio.ts`, `income.ts`, `projections.ts`, `countries/de.ts`, `countries/de-avd.ts`, `countries/de-pension.ts`), `app/api/financial-planning/route.ts`, `lib/localization/planning-availability.ts`, `lib/localization/config.ts`, `lib/localization/financial-country.ts`, `lib/localization/guard.ts`, `proxy.ts`, `app/(app)/investimenti/tasse/page.tsx`, `app/(app)/investimenti/proventi/page.tsx`, `app/(app)/pensione/layout.tsx`, `app/(app)/analitiche/layout.tsx`, `app/(app)/country-unavailable/page.tsx`, `docs/decisioni/2026-10-14-pianificazione-finanziaria-germania.md`, `2026-10-13-paese-prodotto-e-lingua.md`, `2026-10-14-costi-investimenti-germania.md`, `2026-10-14-inflazione-germania.md`

## Purpose
For users whose **product country is DE** (language `en` or `de`), replace the Italian tax, dividend-forecast, pension and retirement engines with a dedicated, versioned German planning model (tax year 2026, private German-resident investors, EUR only). The model is one JSON document per `(user, country)` with optimistic concurrency (revision). Estimates are explicitly **not** a tax return: incomplete data blocks the total instead of assuming zero cost.

On 15 Oct 2026 product reduced the visible scope ("disponibilità essenziale"): only the **Tax** and **Income** screens are visible; pension/AVD, retirement and all simulators (sale, crypto, Vorabpauschale scenario, constant-2026 future forecasts) are **retained in code, schema and saved data but hidden** behind per-country switches. They will be re-enabled one at a time after review. Mobile implements the visible scope only (decision 0004): hidden parts are out of scope until the web shows them.

Product country and language are independent (decision 2026-10-13): IT → `it|en`, DE → `en|de`. Changing country never deletes data. Other DE rollout phases already live in other areas: inflation-adjusted returns use German HICP (11-analytics/07 performance), and investment costs show only recorded fees/taxes, no Italian stamp duty (07-investments).

**UI copy note:** strings in this area are English source keys passed to `t()` (translated to German through `lib/localization/catalogs/de.json`); they are quoted verbatim below (e.g. `Save plan` → de `Plan speichern`).

## Entry points & navigation
- Route policy (`isCountryPathAvailable`, `isPlanningAvailable`) for DE, with switches `DE: { tax: true, income: true, pension: false, retirement: false, simulations: false }`:

| Path | DE today | Rendered |
|---|---|---|
| `/investimenti/tasse` (exact) | available (`tax` = true) | `PlanningScreen section="tax"` inside the Investimenti layout |
| `/investimenti/proventi` (exact) | available (`income` = true) | `PlanningScreen section="income"` inside the Investimenti layout |
| `/investimenti/tasse/*`, `/investimenti/proventi/*` subpaths | blocked | redirect to `/country-unavailable` |
| `/pensione` (exact) | blocked (`pension` = false) | proxy redirects to `/country-unavailable`; the layout would render `PlanningScreen section="pension"` if the switch were on |
| `/pensione/*` subpaths (`dati`, `andamento`, `proiezione`, `scenari`) | always blocked | `/country-unavailable` |
| `/analitiche` (exact) | blocked (`retirement` = false) | proxy redirects; layout would render `PlanningScreen section="retirement"` if on |
| `/analitiche/*` incl. `/analitiche/obiettivi` | always blocked | `/country-unavailable` |
| `/api/financial-planning` | allowed for DE | see API |
| `/api/pension`, `/api/analytics`, `/api/goals`, `/api/sidebar/fire`, `/api/investments/tax-carryforwards` (+ subpaths) | blocked | 403 `{code:"country_feature_unavailable", error:"Questa funzione non è ancora disponibile per la Germania."}` (translated) |

- For IT every path is available (Italian screens; see 07, 09, 11).
- Navigation filtering uses the same policy: sidebar and mobile nav hide `Pensione` and `Analitiche` for DE; the Investimenti tabs keep `Dividendi` (`/investimenti/proventi`) and `Tasse` (`/investimenti/tasse`); "Novità" entries, notification kinds and the Panoramica goals card linked to blocked paths are hidden (see 00, 02, 15).
- Enforcement is triple: client navigation filter, `proxy.ts` (pages → redirect `/country-unavailable`; APIs → 403), and `withCountryGuard` on protected API handlers.
- The Tax and Income screens appear as the `Tasse` and `Dividendi` tabs under the Investimenti header (title `Investimenti`, `Importazioni fatte`, `Importa`, `Registra` actions, tabs, broker selector) — see 07.

## Screens

### 1. Country-unavailable page (`/country-unavailable`)
- Server-rendered, in the user's language. Title `Questa funzione non è ancora disponibile per la Germania.`; text `Per la Germania, tasse, pensione, previsioni dei dividendi e pianificazione del pensionamento non sono ancora disponibili. I dati esistenti vengono conservati.`; link `Panoramica` → `/panoramica`.
- Reached by bookmarks/direct links/deep links to blocked paths.

### 2. PlanningScreen shell (common to all sections)
- Title by section: tax `German investment taxes · 2026`, income `Income`, pension `German pensions`, retirement `Retirement planning`.
- Data: `GET /api/financial-planning` (query key per country) **and** the investments overview `GET /api/investments/overview?period=max` (all operations, instruments, dividends, FX, settings).
- States: loading `Loading…`; error (either request) `Could not load the plan.` + `Retry` (refetches both); account currency ≠ EUR → `German financial planning currently requires account currency EUR. Your saved data has not been changed.` (no editor).
- **Save bar** (sticky at top of the content): status `Unsaved changes` / `Plan saved`; button `Save plan` / `Saving…`, disabled when not dirty, invalid, or saving.
  - Client validates the whole document with the same zod schema; invalid → `Check the entered names, dates and numeric limits before saving.` (save disabled).
  - `PUT /api/financial-planning {plan, revision}`. 409 → `This plan changed in another tab. Reload before saving.`; other failure → `Could not save. Your changes are still here.` Edits are kept on error. On success the cache is replaced with the server response (new revision) and the editor resets to the saved state. Analytics `financial_plan_saved {country:"DE", section}`.
  - The editor is keyed by section and revision: switching section (tab) discards unsaved edits. **No unsaved-changes warning** on leaving.
- Footer disclaimer `Planning estimates for German residents holding private assets. Results depend on complete records and your assumptions; they do not replace a tax return or pension statement.` and expandable `Rules and official sources` listing links EStG §32d, InvStG §18, InvStG §20, RWBestV 2026, EStG §23 (external, open in browser).
- All amounts formatted as EUR in the user's locale; an unavailable estimate shows `More information needed` instead of a number.
- Common input behaviour (`NumberField`): numeric input with min (default 0), optional max (default cap 1e12), step (default 0.01); out-of-range values are clamped as typed, empty → 0. Percent fields are entered as % and stored as fractions. `Choice` = select with translated labels and stable stored values.

### 3. Tax section — `/investimenti/tasse` (VISIBLE)
Panel `German investment taxes · 2026`:
- Intro `Annual private-investor estimate in EUR, using FIFO separately for each custody account. This is not a broker withholding calculation. Foreign tax credits, treaty relief, business holdings and favourable-rate assessment require individual review.`
- Inputs:
  - `Assessment`: `Individual (€1,000 allowance)` (default) | `Joint (€2,000 allowance)`.
  - `Church tax`: `None` (default) | `8%` | `9%`.
  - `Allowance already used outside this portfolio (€)`; `Verified creditable foreign tax after allowances and losses (€)`; `Share loss carryforward (€)`; `General loss carryforward (€)`; `Additional taxable capital income / advances received (€)` — all ≥0, default 0.
  - Checkbox `I have checked the full acquisition history, custody accounts and loss balances. No unrecorded transfers or corporate actions affect these lots.` (default off).
- Help texts: `Use available loss balances only; cross-bank offsets may require a loss certificate and assessment. Do not enter the same external income both as used allowance and additional income.` and `Enter only foreign tax confirmed as creditable for these taxable earnings after treaty limits, refunds, allowances and losses. Recorded withholding is not automatically treated as creditable.`
- **Information needed** list (a11y label `Information needed`), one line per issue, prefixed with instrument name when instrument-specific:
  - `German tax estimates require portfolio currency EUR.`
  - `Confirm complete acquisition history and custody accounts before calculating.` (checkbox unchecked)
  - `Confirm the fund tax classification using its documentation.` (fund with unknown classification and a 2026 income/sale)
  - `Confirm prior fund advances and any taxable advances received this year.` (fund history not confirmed)
  - `Pre-2009 securities and pre-2018 fund lots need individual tax treatment.`
  - `This instrument or adjustment requires individual tax treatment.` (e.g. crypto/ETC, `rettifica`)
  - `A sale has missing acquisition lots. Add the original purchases in the same custody account.`
  - `An operation has missing or invalid amounts.`
  - Any issue → all estimate results show `More information needed`.
- Results (rows label + amount): `Foreign tax credit applied`, `Estimated capital income tax`, `Solidarity surcharge`, `Church tax`, `Estimated total tax`, `Recorded taxes (shown separately)` (sum of taxes recorded on 2026 operations, always shown), `Remaining share losses`, `Remaining general losses`.
- Expandable `Realised events included`: date · instrument name · taxable amount for each 2026 realised event (sales, dividends, coupons).
- Calculation at a glance (domain spec holds formulas): FIFO per custody account (portfolio + imported account key) and instrument; fees in cost; operation FX; bonds quoted in % of nominal; splits; share gains vs general basket; allowance; 25% capital tax with church-tax denominator; 5.5% solidarity; foreign credit capped. Crypto excluded (separate §23 scenario).

Panel `Funds and ETFs`:
- Text `Classification must come from the fund tax documents, not its name. Enter gross prior advances attributable to each sale before partial exemption. Enter this year's taxable advances above as additional capital income.`
- One select per ETF/fund instrument with operations, labelled with the instrument name: `Not yet classified` (default) | `Equity fund (30% exemption)` | `Mixed fund (15% exemption)` | `Property fund (60% exemption)` | `Foreign property fund (80% exemption)` | `Other fund (no exemption)`.
- One number field per 2026 fund sale: `{instrument} · {date} · Prior gross advances (€)`.
- Checkbox `I checked prior advances and current-year advance income against broker records. The fund classification did not change during the holding period.`
- HIDDEN (simulations = false): `2026 Vorabpauschale scenario` sub-section (see §6.1).

HIDDEN (simulations = false) below the panels: `Before you sell` sale simulator (§6.2) and `Private crypto sales · 2026` (§6.3).

### 4. Income section — `/investimenti/proventi` (tab `Dividendi`) (VISIBLE)
- Panel `Recorded income`: per calendar year (newest first) heading `{year}` and rows `Gross income`, `Recorded withholding and fees`, `Recorded net income` (EUR, using operation FX). Empty: `No recorded income yet.`
- Panel `Income forecast · next 12 months`:
  - HIDDEN (simulations = false): select `Future-year net forecasts` and its scenario note (§6.4). With the switch off, the forecast always uses `verified` mode **without overwriting** the saved preference.
  - `Gross forecasts repeat historical dividends for current holdings or use recorded bond terms. Payments and exchange rates can change. Missing history is not a forecast of zero income.`
  - `Forecast gross income` total.
  - `Net forecasts use the Tax section's annual allowances and losses. They are unavailable for unvalidated tax years or incomplete tax history. Foreign withholding and treaty credits are not estimated.`
  - If some bonds lack coupon terms: `Some bonds have no complete coupon terms.`
  - Table (horizontally scrollable): `Date`, `Instrument`, `Gross income`, `Estimated net income` per forecast payment (principal redemptions excluded). Net = gross minus the incremental 2026 tax for that payment, using allowance/losses once; `More information needed` when the tax report has issues, the fund is unclassified, the instrument type is not eligible, or the payment is in a non-validated year. Empty: `No payments can currently be forecast.`
- The Tax section's saved settings (classification, allowance, losses, confirmations) drive the net column; changes on the Tax tab must be saved to affect Income.

### 5. Hidden sections (pension = false, retirement = false) — retained, not visible today
Implement behind the switches; content as in code.

#### 5.1 Pension section (`/pensione` → `German pensions`)
- Panel `German pensions`: texts `Track statutory, occupational, Riester, Rürup, private pensions and Altersvorsorgedepots separately. Pension entitlements are future income, not liquid assets. Contract capital is shown only here and is not added automatically to your portfolio or net worth.` and `Use provider statements for contributions, contract value, payment date and gross pension. Projections are before income tax, health and care contributions. Subsidies, tax deductions, guarantees, surrender values and eligibility are not inferred.`; empty `Add your first pension from its latest statement.`; button `Add pension` (new item named `My pension`, kind statutory; max 100 pensions).
- Panel `Pension taxes and health insurance` (§5.3).
- One panel per pension (title = user name):
  - `Name` (1–100), `Pension type`: `Statutory pension (GRV)` | `Occupational pension (bAV)` | `Riester pension` | `Basis pension (Rürup)` | `Private pension` | `Altersvorsorgedepot (AVD)`. Choosing statutory/Rürup/Riester/AVD forces payout `income`.
  - `Years until payment starts` (0–80, int; hidden for enabled AVD where it is derived).
  - Statutory: `Accrued pension points` (≤1000), `Assumed additional points per year` (≤10), `Access factor from your pension statement` (0–2, step 0.001); note `Old-age pension: points × access factor × €42.52, the pension value from July 2026. Future pension-value increases and eligibility are not assumed.`
  - Others: `Current contract capital (€)`, `Monthly total contribution (€)`, `Assumed annual return after costs (%)` (−50…30); for bAV/private `Retirement payout used in the plan`: `Monthly income` | `Contractually available lump sum`; when income (and not AVD drawdown) `Expected monthly gross pension from provider (€)`; result `Projected contract capital`.
  - Tax: `Tax treatment of pension payments`: `Not yet confirmed` | `Fully funded · taxable in full` | `Unfunded private lifetime annuity` | `Taxable amount from provider statement`; statutory/Rürup also `Pension start year for taxation` (1900–2200), `Fixed annual tax-free pension amount (€)` and checkbox `Derive tax-free amount from start-year share and constant pension`; private annuity `Age at lifetime annuity start`; statement `Annual taxable payments from statement (€)`.
  - Results: `Projected monthly gross pension`; AVD enabled also `Total projected grants`, `Initial lump sum`.
  - `Remove pension` (immediate, no confirmation; persisted only on Save).
  - AVD not enabled hint `Enable the AVD calculation below to include grants, tax comparisons and fixed-term payouts from 2027.`

#### 5.2 AVD editor (inside an AVD pension)
- Checkbox `Calculate AVD grants and payouts`. When on: texts `AVD rules start in 2027. …` and `Use one combined AVD scenario per person to avoid duplicate allowances. Payout must start after the first contribution year.`; fields `Contribution start year` (2027–2100), `Confirmed grant eligibility` (`No confirmed entitlement` | `Direct entitlement` | `Indirect entitlement through spouse`), `Eligible spouse's annual contribution (€)` (≤6840, indirect only), `Age at contribution start` (18–100), `Children allocated to this contract` (0–20) with one `Remaining allowance years for child {0}` (0–30) each, `Taxable household income before AVD deduction (€)`, `AVD payout method` (`Lifetime pension from provider statement` | `Fixed-term drawdown`), `Age when payouts start` (65–70), `Initial lump sum (%)` (≤30), drawdown only `Age when payouts end` (85–120) and `Annual return during payouts (%)`; checkbox `Starter bonus entitlement confirmed and not previously used`.
- Results `First-year basic grant`, `First-year child grants`, `One-time starter bonus`, `Additional tax refund · 2026 tariff comparison`, plus two explanatory notes.
- Years until payment is derived: payoutStartAge − ageAtStart + contributionStartYear − 2026.
- Schema rules: max one enabled AVD per plan; annual contribution ≤6840; dates/ages must agree; payout after contribution start; drawdown end > start.

#### 5.3 Pension taxes and health insurance (shared by pension and retirement)
- `Net pension calculation`: `Manual deduction assumption` (default) | `German rules · constant 2026 benchmark`. Rules mode shows: `Health insurance in retirement` (`Compulsory pensioner insurance (KVdR)` | `Voluntary statutory insurance` | `Private insurance · actual net premium`), `Other annual taxable income (€)`, `Annual child allowances for surcharge calculation (€)`, `Other annual deductions not already included (€)`; statutory insurance: (voluntary) `Other annual income assessed for health insurance (€)`, checkbox `Statutory pension health-insurance subsidy confirmed`, `Health insurer additional contribution (%)` (≤10, default 2.9), `Children under 25 for care insurance` (0–20), checkbox `Childless care-insurance surcharge applies` (mutually exclusive with children); private: `Annual private health and care premium after subsidies (€)`, `Tax-deductible part of that premium (€)` (≤ premium).
- Heading `First retirement year · annual nominal amounts`; alerts for unconfirmed tax treatment or private lump sums under voluntary insurance; rows `Gross pension payments`, `Taxable pension payments`, `Health insurance contributions`, `Care insurance contributions`, `Additional income tax`, `Solidarity surcharge`, `Church tax`, `Net pension payments`.

#### 5.4 Retirement section (`/analitiche` → `Retirement planning`)
- Shows §5.3 then panel `Retirement planning`: `Liquid investment capital today (€)`, `Annual saving in today's euros (€)`, `Annual spending in today's euros (€)`, `Years until retirement` (0–80), `Real annual return after costs (%)` (default 2), `Withdrawal rate for reference target (%)` (0.5–20, default 3.5), `Annual inflation assumption (%)` (default 2), manual mode only `Assumed pension tax and social deductions (%)` (default 25), `Assumed tax share of withdrawals (%)` (≤90).
- Results `Liquid capital at retirement`, `Reference FIRE target before pension income`; status: unconfirmed tax → confirm message; spending 0 → `Enter annual spending to assess your retirement plan.`; else `Capital lasts through the 50-year scenario under these assumptions.` or `Capital runs out in retirement year {0}.`
- Table (`Retirement year`, `Pension income`, `Withdrawal`, `Remaining capital`) showing year 1 and every 5th year of a 50-year scenario.

### 6. Hidden simulators (simulations = false)
#### 6.1 `2026 Vorabpauschale scenario` (inside `Funds and ETFs`)
`Fund classification`, `Value at start of year (€)`, `Value at end of year (€)`, `Annual distributions (€)`, `Acquisition month (1–12)`; results `Gross advance amount`, `After partial exemption`; note on 3.20% base rate, received in 2027.
#### 6.2 `Before you sell` (sale simulator, not persisted)
Text `Simulate a sale using the same German tax settings and custody-account FIFO lots. No operation is saved. Complete the tax information above first.`; `Instrument` (stocks, ETF, funds, bonds), `Custody account` (`{portfolio} · {provider|Imported account} · {last 6 of account}` or `Manual entries`), `Units / bond nominal`, `Sale price ({cur})` or `Sale price (% of nominal)`, `Exchange rate to EUR` (>0), `Disposal fees (€)`, `Prior gross advances (€)`; button `Simulate sale` (disabled without account, quantity ≤0 or FX ≤0); results `Simulated realised gain`, `Change in estimated annual tax`; any input change clears the result. Analytics `financial_sale_simulated`.
#### 6.3 `Private crypto sales · 2026`
Lots list (each: `Name`, `Acquisition date`, `Sale date` limited to 2026, `Sale proceeds (€)`, `Acquisition cost (€)`, `Disposal fees (€)`, `Remove sale`), `Add sale` (max 1000), `Other private-sale gains or losses (€)` (signed), `Private-sale loss carryforward (€)`, `Other taxable income, not gross salary (€)`; results `Short-term net gains`, `Long-term exempt gains`, `Taxable private-sale gains`, `Additional income tax (before surcharges)`. Schema: sold ≥ acquired, sold in 2026.
#### 6.4 Future-year net forecasts (Income)
`Future-year net forecasts`: `Validated tax years only` | `Compare using unchanged 2026 capital-tax rules`; scenario rows flagged `2026 rules scenario`.

### 7. API — `/api/financial-planning`
- `GET` → `{plan, revision}`; when no saved row, the default plan (all defaults) with revision 0. 403 `{error:"country_feature_unavailable"}` when the user's country has no planning model (IT).
- `PUT {plan, revision}` (strict) → validates the full German document; `plan.country` must equal the user's country, else 400 `{error:"invalid_plan"}`; updates only if the stored revision equals `revision`, then returns `{plan, revision: revision+1}`; otherwise 409 `{error:"plan_changed"}`.
- Document (`germanPlanSchema`, version 1, country `DE`): `tax` (year 2026 literal, futureForecast, joint, churchRate 0|0.08|0.09, amounts 0–1e12, confirmations, `fundKinds` by instrument id, `priorAdvancesBySale` by transaction id), `fund`, `pensions[≤100]`, `pensionTax`, `retirement`, `crypto[≤1000]`, `cryptoOtherGains`, `cryptoLossCarryforward`, `otherTaxableIncome`. Unknown keys rejected; duplicate ids rejected. New fields have defaults (backward compatible).
- Plans are included in account export and deleted by account reset (15-settings).

## Requirements

#### Routing & gating
- **PLAN-001** The app shall decide visibility from the product country, never from the language.
- **PLAN-002** For DE, the app shall show the German Tax screen at the `Tasse` tab and the German Income screen at the `Dividendi` tab of Investimenti, and never call Italian tax/forecast APIs there.
- **PLAN-003** For DE, the app shall hide `Pensione` and `Analitiche` (including Obiettivi) from all navigation and route any direct or deep link to them or their subpaths, and to subpaths of `Tasse`/`Dividendi`, to the country-unavailable screen.
- **PLAN-004** The app shall show for DE exactly the planning sections the web shows today (Tax, Income) and nothing else. _(Reduced by decision 0004: no runtime switches on mobile.)_
- **PLAN-005** The country-unavailable screen shall show the title, explanation that existing data is preserved, and a link to Panoramica.
- **PLAN-006** The app shall treat 403 `country_feature_unavailable` responses as "feature unavailable" (not as a generic error). _API: `/api/pension`, `/api/analytics`, `/api/goals`, `/api/sidebar/fire`, `/api/investments/tax-carryforwards`_

#### Plan document & saving
- **PLAN-007** The app shall load the saved German plan and its revision, falling back to defaults with revision 0. _API: `GET /api/financial-planning`_
- **PLAN-008** The app shall load all investment operations (period `max`) as input for the German calculations. _API: `GET /api/investments/overview?period=max`_
- **PLAN-009** The app shall show an explanatory message instead of the editor when the account currency is not EUR, without changing saved data.
- **PLAN-010** The app shall show a persistent save bar with `Unsaved changes`/`Plan saved` and a `Save plan` button enabled only when the plan is changed and valid.
- **PLAN-011** The app shall validate the whole plan client-side with the same rules as the server and block saving with `Check the entered names, dates and numeric limits before saving.` when invalid.
- **PLAN-012** The app shall save the full plan with the loaded revision and, on success, adopt the returned plan and revision. _API: `PUT /api/financial-planning`_
- **PLAN-013** On 409 the app shall keep the user's edits and show `This plan changed in another tab. Reload before saving.`; on other errors `Could not save. Your changes are still here.` _API: `PUT /api/financial-planning`_
- **PLAN-014** The app shall preserve saved values of hidden sections and hidden settings when saving visible sections.
- **PLAN-015** Numeric inputs shall clamp to their min/max, store percentages as fractions and treat empty input as 0.
- **PLAN-016** The app shall show `More information needed` wherever an estimate is unavailable, never 0.
- **PLAN-017** Each section shall show the planning disclaimer and the list of official sources.

#### Tax
- **PLAN-018** The app shall let the user choose individual/joint assessment, church tax (none/8%/9%) and enter allowance used elsewhere, verified foreign credit, share and general loss carryforwards and additional capital income (all ≥0 EUR).
- **PLAN-019** The app shall require explicit confirmation of complete acquisition history before showing tax estimates.
- **PLAN-020** The app shall compute 2026 realised events with FIFO per custody account and instrument, including fees, operation FX, percent-of-nominal bonds and splits, excluding crypto.
- **PLAN-021** The app shall list every blocking issue (currency, history, classification, fund history, legacy lots, unsupported instruments/adjustments, missing lots, invalid amounts), prefixed by instrument name where applicable.
- **PLAN-022** When issues exist the app shall not show any tax total; otherwise it shall show foreign credit applied, capital income tax, solidarity surcharge, church tax, total tax, remaining share and general losses.
- **PLAN-023** The app shall always show recorded taxes of the year separately from the estimate.
- **PLAN-024** The app shall list the realised events included (date, instrument, taxable amount) in an expandable section.
- **PLAN-025** The app shall let the user classify each held/traded ETF or fund (unknown, equity 30%, mixed 15%, property 60%, foreign property 80%, other 0%) and enter prior gross advances per 2026 fund sale.
- **PLAN-026** The app shall require confirmation of fund advance history before estimating fund-related tax.

#### Income
- **PLAN-027** The app shall show recorded income per year (gross, withholding and fees, net), newest first, or `No recorded income yet.`
- **PLAN-028** The app shall forecast gross income for the next 12 months from historical dividends of current holdings and recorded bond terms, excluding principal redemptions, and show the total.
- **PLAN-029** The app shall show an estimated net amount per forecast payment using the Tax section's settings incrementally (allowance and losses used once), or `More information needed` when not computable.
- **PLAN-030** The app shall flag bonds without complete coupon terms and show `No payments can currently be forecast.` when the list is empty.
- **PLAN-031** While `simulations` is off, the income forecast shall use validated tax years only and hide the future-year selector without overwriting the saved choice.

#### Hidden features (behind switches) — OUT OF SCOPE (decision 0004)
_Not visible on the web today, so not built on mobile. Kept for reference; they return to scope only when the web turns them on._
- **PLAN-032** When `pension` is on, the app shall let the user add, edit and remove pensions of six kinds with kind-specific fields and show projected capital and monthly gross pension.
- **PLAN-033** When `pension` is on, the app shall offer the AVD calculation (grants, starter bonus, tax comparison, payout method) enforcing one enabled AVD per plan and consistent ages/dates.
- **PLAN-034** When `pension` or `retirement` is on, the app shall offer the net-pension calculation (manual or German rules 2026) with health/care insurance options and show the first-retirement-year breakdown.
- **PLAN-035** When `retirement` is on, the app shall project liquid capital at retirement, a reference FIRE target, and a 50-year drawdown table with the depletion year.
- **PLAN-036** When `simulations` is on, the app shall show the 2026 Vorabpauschale scenario in the Funds panel.
- **PLAN-037** When `simulations` is on, the app shall offer a sale simulator using the same FIFO engine that shows the simulated gain and change in annual tax without saving any operation.
- **PLAN-038** When `simulations` is on, the app shall offer the private crypto sales scenario (2026 sales only, sale after acquisition, €1,000 threshold, one-year exemption).
- **PLAN-039** When `simulations` is on, the Income screen shall offer future-year net forecasts under unchanged 2026 rules, flagging such rows as `2026 rules scenario`.

## Mobile adaptation notes
- **Proposal — needs product sign-off:** The save bar becomes a bottom-anchored bar (above the tab/nav bar) with status text and `Save plan`; when the user leaves the screen with unsaved changes, show a confirmation sheet `Unsaved changes` with Save / Discard (web silently discards).
- **Proposal — needs product sign-off:** Result rows stay as label/amount list rows; the `Realised events included`, `Rules and official sources` expanders become disclosure rows; source links open the in-app browser.
- **Proposal — needs product sign-off:** The income forecast table becomes a list of cards (date, instrument, gross, net) on phone instead of a horizontally scrolling table.
- **Proposal — needs product sign-off:** Selects use native pickers (menu/sheet); numeric fields use decimal keypad with locale separators and show clamping limits as helper text.
- **Proposal — needs product sign-off:** Deep links to blocked paths (including from emails, notifications and "Novità") open the native country-unavailable screen.
- **Proposal — needs product sign-off:** On 409, offer a `Reload` action in the error banner that refetches the plan (discarding local edits only after a confirmation).

### Implemented on mobile (Phase 4b, 2026-10-19)
All six notes above are adopted (decision 0003). Details: the save bar also carries the save/validation messages (an alert at
the top of a long scrolled form would be invisible); the unsaved-changes sheet appears when leaving `Tasse` for another
Investimenti tab or going back (the draft survives app-tab switches); results of the edited plan come from
`POST /api/financial-planning/results` (debounced), the saved plan's from `?include=results`; instrument names and 2026
fund-sale dates from `GET /api/investments/overview?period=1mese`. Dates use `d MMM y` (web: numeric `Intl.DateTimeFormat`).
Backend gap: the results carry instrument ids only (no names, no sale dates), which is why the overview is still fetched.

## Open questions
1. The country-unavailable text says taxes and dividend forecasts are not available for Germany, but the Tax and Income screens are now visible — the copy is outdated.
2. Proxy blocks `/pensione` and `/analitiche` for DE, so the layout branches that render `PlanningScreen` for pension/retirement are dead code today; when switches turn on, only the exact paths open (all subpaths remain blocked). Confirm intended routing on mobile.
3. The Investimenti broker selector stays visible on the DE Tasse/Dividendi tabs, but the planning screens use the unfiltered overview — selection has no effect. Hide it on mobile?
4. Switching between Tasse and Dividendi tabs discards unsaved edits without warning; Income depends on saved Tax settings only.
5. All German calculations run client-side (`lib/financial-planning`); mobile must port them identically to both platforms or get server endpoints (none exist).
6. `/api/financial-planning` returns 403 `{error:"country_feature_unavailable"}` without the `code` field used by proxy/guard 403s — inconsistent error shape.
7. Tax year is hard-coded to 2026 (`year: z.literal(2026)`); behaviour from 1 Jan 2027 is undefined (sale-date limits, "2026" titles, crypto default dates `2026-10-14`). Needs a product decision before year end.
8. Source keys in this area are English, unlike the rest of the app (Italian); `Sale price (% of nominal)` bypasses the `{0}` formatting path and some labels are double-translated (`t()` inside `NumberField` on already translated text).
9. Remove buttons (pension, crypto sale) have no confirmation; data only disappears after Save.
10. The `fundKinds` and `priorAdvancesBySale` maps are keyed by instrument/transaction ids; deleted operations leave orphan keys — harmless but grows the document.
