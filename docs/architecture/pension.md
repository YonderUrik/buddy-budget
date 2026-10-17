# Pension funds and TFR

This part turns the "snapshots" a user copies from the client area of an Italian supplementary pension fund (fondo pensione, PIP) into a return, an estimate of the net amount if the fund were withdrawn today, a comparison with leaving the TFR (trattamento di fine rapporto, Italian severance pay) with the employer, a projection to retirement, and the "Previdenza" (pension) class of net worth. The engine is [`lib/calc/pension.ts`](../../lib/calc/pension.ts); data access, client state and import live in [`lib/pension/`](../../lib/pension/); screens are the five tabs of `/pensione` ([`app/(app)/pensione/`](../../app/(app)/pensione/)).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

> **Status: estimates, not tax or pension advice.** The tax parameters in `PENSION_TAX_RULES` come from COVIP and MEFOP material and are marked in the code as "da validare con un professionista" (to be validated by a professional). The company TFR revaluation values are marked "valori a memoria, da verificare" (from memory, to verify). No figure on this page is a certified calculation.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Store funds and snapshots | form, CSV/XLSX/pasted rows | `pension_funds`, `pension_snapshots` | [`app/api/pension/`](../../app/api/pension/), [`lib/validation/pension.ts`](../../lib/validation/pension.ts) |
| Load | user id | `PensionOverviewData` (amounts as numbers, snapshots by date) | [`lib/pension/data.ts`](../../lib/pension/data.ts) `loadUserPension` |
| Derive contributions | snapshots, adhesion date | `DerivedContribution[]` | `deriveContributions` |
| Return | snapshots, adhesion date | `PensionPerformance` (gain, XIRR) | `computePensionPerformance` |
| Year by year | snapshots | `YearBreakdown[]` | `yearlyBreakdown` |
| Withdrawal today | last snapshot, years of participation | `WithdrawalScenario[]` | `exitTaxRate`, `withdrawalScenarios`, [`use-rate-simulation.ts`](../../lib/pension/use-rate-simulation.ts) |
| TFR comparison | derived contributions, assumed inflation | `CompanyTfrComparison` | `companyTfrValue` |
| Projection | last value, recent quarterly contribution | `ProjectionPoint[]` in today's euros | `recentQuarterlyContribution`, `projectPension` |
| Net worth | funds with snapshots | "previdenza" rows and total | [`lib/net-worth/pension-history.ts`](../../lib/net-worth/pension-history.ts) |

```text
user reads client area ──► snapshot (date, netContributions, value) ──► pension_snapshots
                                                                            │
                         loadUserPension ◄──────────────────────────────────┘
                               │
     ┌─────────────────────────┼─────────────────────────────┬──────────────────────┐
deriveContributions     withdrawalScenarios          projectPension          pensionTotalOn /
  ├─► computePensionPerformance (XIRR)                                       buildPensionHistoryRows
  └─► companyTfrValue                                                          ──► Panoramica, sidebar,
                                                                                   Analitiche
```

`PensionProvider` ([`lib/pension/pension-context.tsx`](../../lib/pension/pension-context.tsx)) computes performance, contributions, scenarios, TFR comparison and quarterly contribution once for the selected fund and shares them with the tabs.

| Tab | Route | Shows |
|---|---|---|
| Panoramica (overview) | `/pensione` | value, gain, XIRR, net range if withdrawn for retirement, 25-year base projection |
| Andamento (trend) | `/pensione/andamento` | contributions and value over time, year-by-year breakdown |
| Scenari (scenarios) | `/pensione/scenari` | withdrawal today, fund vs company TFR, exit-rate timeline with simulation |
| Proiezione (projection) | `/pensione/proiezione` | three-scenario projection with sliders |
| I tuoi dati (your data) | `/pensione/dati` | fund, snapshots, import |

## 2. Principles

**P1 — Snapshots are the only source.** The fund value is never stored on the fund. Contributions, gains and history are derived from the differences between snapshots.

**P2 — Pure engine.** `lib/calc/pension.ts` has no DB or UI dependency. All tax and legal parameters sit in one constant, `PENSION_TAX_RULES`, with `validFromYear: 2026`.

**P3 — Computed, never stored, for net worth.** "previdenza" is an asset class of net worth but no row is written to `net_worth_snapshots`; the API rebuilds it from snapshots on every request (comment in [`lib/db/schema/net-worth-snapshots.ts`](../../lib/db/schema/net-worth-snapshots.ts)).

**P4 — One snapshot per fund per day, idempotent writes.** A unique key on `(fund_id, date)` and `onConflictDoUpdate` make saving the same date a replacement. Import uses the same rule, so re-importing a file changes nothing.

**P5 — Ownership checked, never leaked.** `findOwnPensionFund` returns `null` both for a missing fund and for another user's fund; routes answer 404 in both cases.

**P6 — Italy only.** Every `/api/pension` route is wrapped in `withCountryGuard`; `/pensione` and `/api/pension` are blocked for `DE` by `isCountryPathAvailable` ([`lib/localization/config.ts`](../../lib/localization/config.ts)); `loadUserPension` returns no funds for a `DE` user, so nothing reaches net worth either.

**P7 — Simulations stay local.** Moving the exit-rate chip recomputes scenarios in the browser; nothing is saved. Only the product event `pension_rate_simulated` (with the simulated years) is sent.

## 3. Data model

| Table | Columns | Notes |
|---|---|---|
| `pension_funds` | `id`, `user_id`, `name`, `adhesion_date`, timestamps | `adhesion_date` is the first adhesion to any pension scheme (also with another employer): it drives the exit rate |
| `pension_snapshots` | `id`, `fund_id`, `user_id` (duplicated for per-user filtering), `date`, `net_contributions`, `value` | unique `(fund_id, date)`; amounts `numeric(14,2)` |

Schema: [`lib/db/schema/pension.ts`](../../lib/db/schema/pension.ts). Limits in [`lib/pension/limits.ts`](../../lib/pension/limits.ts) and [`lib/validation/pension.ts`](../../lib/validation/pension.ts): 10 funds per user, 5,000 snapshots per fund, 1,000 rows per import, amounts 0 to 100,000,000, name up to 80 characters, dates from 1950 to tomorrow (one day of timezone tolerance).

Always computed: derived contributions, gain, XIRR, yearly breakdown, exit rate, net estimates, company TFR value, projection, net worth rows.

Fund and snapshots are included in the account export and removed by the account reset and deletion ([`lib/account/export.ts`](../../lib/account/export.ts), [`lib/account/lifecycle.ts`](../../lib/account/lifecycle.ts)).

## 4. How it works

### 4.1 Snapshot: net contributions vs market value

A snapshot is what the client area shows on one day:

| Field | Meaning |
|---|---|
| `netContributions` | total contributions paid in up to that day, net of entry costs (TFR, employee, employer) |
| `value` | controvalore: market value of the position that day |

```text
gain    = value − netContributions        (last snapshot)
gainPct = gain / netContributions         (null if netContributions = 0)
```

Example: net contributions €24,000, value €30,000 → gain €6,000, +25%.

### 4.2 Derived contributions

`deriveContributions` turns snapshots into dated cash flows.

```text
for each later snapshot i:  contribution(date_i) = netContributions_i − netContributions_{i−1}   (if |Δ| > 0.005)
first snapshot, adhesion before it:
    months   = round(days(adhesion → first) / (365/12))
    payments = max(1, round(months / 3))                    (TFR is paid in quarterly, TFR_PAYMENT_MONTHS)
    each payment = first.netContributions / payments, evenly spaced, flagged estimated
first snapshot, no earlier adhesion:  one contribution of first.netContributions on the first date
```

Example. Adhesion 1 January 2020, first snapshot 1 January 2021 with €4,000: 12 months → 4 estimated payments of €1,000 roughly every quarter of 2020. A snapshot on 1 July 2021 showing €6,000 adds a real €2,000 contribution dated 1 July 2021. A negative delta (for example a partial advance) becomes a negative contribution.

### 4.3 Return (money-weighted)

`computePensionPerformance` builds the investor's cash flows (each contribution as an outflow, the last value as an inflow on the last date) and calls `moneyWeightedReturn` from [`lib/calc/returns.ts`](../../lib/calc/returns.ts), an XIRR on daily compounding.

```text
flows      = [ (date_k, −contribution_k) ... , (lastDate, +lastValue) ]
find r_d such that Σ flow / (1 + r_d)^(days from first flow) = 0
annual     = (1 + r_d)^365 − 1
approximate = true when any contribution is estimated (§4.2)
```

A euro paid in yesterday has not earned anything yet, so a fund with fresh contributions does not show a misleading percentage. `annualReturn` is `null` when the XIRR does not converge or the period is zero days.

### 4.4 Year-by-year breakdown

`yearlyBreakdown` uses the last snapshot of each calendar year; the first year starts from zero and a year without snapshots is skipped (its effect lands in the next year).

```text
contributions(Y) = netContributions_end(Y) − netContributions_end(Y−1)
gain(Y)          = value_end(Y) − value_end(Y−1) − contributions(Y)
returnRate(Y)    = gain(Y) / (value_end(Y−1) + contributions(Y))     (null if base ≤ 0; not annualised)
partial          = last snapshot overall and not dated 31 December
```

Example. End of 2024: contributions €10,000, value €11,000. End of 2025: €13,000 and €15,000. 2025 → contributions €3,000, gain €1,000, return €1,000 / €14,000 = 7.1%.

### 4.5 Exit tax rate

For contributions paid since 2007 the benefit is taxed at 15%, reduced by 0.30 points for each year of participation beyond the fifteenth, down to 9%.

```text
exitTaxRate(years) = max(9%, 15% − max(0, years − 15) × 0.3%)
years              = whole years from adhesionDate to today (wholeYearsBetween)
```

| Years of participation | Rate |
|---|---|
| 0 to 15 | 15.0% |
| 20 | 13.5% |
| 30 | 10.5% |
| 35 or more | 9.0% |

`exitTaxMilestones(adhesionDate)` gives the dates on which the reduction starts (adhesion + 15 years) and the minimum is reached (adhesion + 35 years). Example: adhesion 15 March 2010 → reduction from 15 March 2025, 9% from 15 March 2045. The Scenari tab draws this as a timeline (`EXIT_TAX_TIMELINE_YEARS = 35`); the user can move a chip to simulate other years (`useRateSimulation`, clamped to 0..35).

### 4.6 Withdrawal today

`withdrawalScenarios(value, netContributions, adhesionDate, today, yearsOverride?)` returns three cases. Each gives a range, because the code does not decide which base the tax applies to:

| Reason | Rate |
|---|---|
| `pensionamento` (retirement) | `exitTaxRate(years)` |
| `sanitarie` (medical expenses) | `exitTaxRate(years)` |
| `altri` (redemption or advance for other reasons) | 23% (`exitOtherReasonsRate`) |

```text
base    = min(value, max(0, netContributions))
netLow  = value − rate × value          (prudent: tax on the whole value)
netHigh = value − rate × base           (expected: tax on contributions only; returns already paid 20% during accumulation; to validate)
```

Example. Value €30,000, net contributions €24,000, 20 years of participation (13.5%):

| Reason | Net low | Net high |
|---|---|---|
| Retirement | €25,950 | €26,760 |
| Medical | €25,950 | €26,760 |
| Other reasons (23%) | €23,100 | €24,480 |

### 4.7 Fund vs company TFR

`companyTfrValue(contributions, asOf, inflationRate)` estimates what the same derived contributions would be worth if the TFR had stayed with the employer, revalued by law.

```text
annualRate = 1.5% + 75% × inflation
grown_k    = amount_k × (1 + annualRate)^(days(date_k → asOf) / 365)
gross      = Σ grown_k
net        = Σ [ amount_k + (grown_k − amount_k) × (1 − 17%) ]     (17% substitute tax on the revaluation)
```

Inflation is the constant `ASSUMED_INFLATION = 2%` in [`pension-context.tsx`](../../lib/pension/pension-context.tsx), so `annualRate` is 3%. Example: €1,000 paid five years before the last snapshot → gross €1,159.27, net €1,132.20. The card compares this net figure with the fund's last value; neither side applies the exit tax, so the comparison is between pre-exit amounts.

### 4.8 Projection to retirement

`recentQuarterlyContribution` estimates the current contribution pace from the last 12 months of snapshots (it needs at least 270 days of history and two snapshots, otherwise `null`, then 0 in the context).

```text
before    = latest snapshot dated ≤ lastDate − 365 days (else the first snapshot)
quarterly = (netContributions_last − netContributions_before) / days × 365/4
```

Example: €16,000 on 30 June 2025, €20,000 on 30 June 2026 → €1,000 per quarter.

`projectPension` compounds the last value and a constant quarterly contribution with **real** returns (net of inflation), so results are in today's euros.

```text
each quarter, for s in {prudent, base, optimistic}:
    value_s = value_s × (1 + rate_s)^(1/4) + quarterlyContribution
```

Default rates: prudent 0%, base 2%, optimistic 4%. The Panoramica preview uses 25 years; the Proiezione card has sliders for 1 to 45 years and 0 to €3,000 per quarter (step €20). Example: €20,000 today, €1,000 per quarter, base 2%, one year → €24,429.88.

### 4.9 How it enters net worth ("Previdenza")

[`lib/net-worth/pension-history.ts`](../../lib/net-worth/pension-history.ts):

```text
fundValueOn(fund, d)  = value of the last snapshot dated ≤ d (0 before the first)
pensionTotalOn(funds, d) = Σ fundValueOn(fund, d)
```

- `GET /api/net-worth/snapshots` adds one `previdenza` row per day (`source: "derivato"`) from the first snapshot to yesterday with `buildPensionHistoryRows`; today's value comes from the current total. The history is a step function between snapshots.
- Panoramica adds `previdenza: pensionTotalOn(funds, today)` to the composition. The user can exclude it from the total with a per-device flag (`usePensionInNetWorth`, localStorage key `bb:net-worth-include-pension`, default included); the area stays in the chart in grey.
- The sidebar summary ([`lib/sidebar/summary.ts`](../../lib/sidebar/summary.ts)) adds the pension total and its month change.
- Analitiche ([`lib/analitiche/base.ts`](../../lib/analitiche/base.ts)) counts it in wealth only when the assumption `includePensionFunds` is on.

The value used is the gross market value (controvalore), before exit tax.

Example: fund A last snapshot €30,000 on 30 June, fund B €8,000 on 31 March → Previdenza €38,000; on 1 April, before A's June snapshot, the history shows A's previous snapshot plus €8,000.

### 4.10 Import of snapshots

The file never reaches the server. The client reads CSV (delimiter auto-detected), XLSX or pasted text ([`lib/pension/import/mapping.ts`](../../lib/pension/import/mapping.ts), [`xlsx.ts`](../../lib/pension/import/xlsx.ts)), maps columns to `date`, `netContributions`, `value`, and sends rows. `planSnapshotImport` ([`plan.ts`](../../lib/pension/import/plan.ts)) classifies each row; the same function runs on the client (preview) and on the server (before writing).

| Status | When |
|---|---|
| `new` | date not yet saved |
| `update` | date saved with different values (compared in cents) |
| `unchanged` | identical to the saved snapshot, or repeated identically in the file |
| `error` | implausible date, or the same date twice in the file with different values |

The plan also carries a plan-level `error` when the new rows would push the fund past 5,000 snapshots. Any row or plan error blocks the whole import and nothing is written.

## 5. Limits and out of scope

- Tax rules not validated by a professional; TFR revaluation parameters from memory.
- One adhesion date per fund: no rates by year of joining for contributions, no pre-2007 contributions rules.
- Withdrawal estimates ignore legal limits on each reason, exit costs, and the share that must be paid as an annuity at retirement; they show a range instead of choosing the tax base.
- Inflation for the TFR comparison is a fixed 2%, not the real index (editable inflation is deferred).
- The projection covers one fund at a time, with fixed rates and a constant contribution.
- Employer and voluntary contributions are not separated; no import from the provider's PDF.
- Snapshots cannot be edited in place; saving the same date replaces it.
- The JSDoc of `PensionPerformance.annualReturn` and of the engine header says "ponderato per i tempi" (time-weighted), but the calculation is money-weighted (XIRR).
- Germany: the Italian pension and TFR feature is blocked. German pension and AVD models exist in [`lib/financial-planning/countries/de-pension.ts`](../../lib/financial-planning/countries/de-pension.ts) and [`de-avd.ts`](../../lib/financial-planning/countries/de-avd.ts) but are hidden (`pension: false` in [`planning-availability.ts`](../../lib/localization/planning-availability.ts)); they are not described here.

## 6. Tests

- [`lib/calc/pension.test.ts`](../../lib/calc/pension.test.ts): `addMonths` clamps short months; contributions from snapshot deltas and spread of pre-snapshot history; XIRR where a euro paid yesterday has not earned; `approximate` flag; exit rate 15% → 9% and milestones; withdrawal range and base capped at value; simulated years; TFR revaluation at 1.5% + 75% inflation; quarterly contribution needs history; projection with zero return and scenario ordering; yearly breakdown.
- [`lib/net-worth/pension-history.test.ts`](../../lib/net-worth/pension-history.test.ts): last known snapshot per fund; one row per day to yesterday, as steps; respects the requested start.
- [`lib/pension/import/import.test.ts`](../../lib/pension/import/import.test.ts): column and Italian decimal detection, row errors with reasons, missing columns, new/update/unchanged, idempotent re-import, duplicate dates, implausible dates and the snapshot limit, XLSX reading and serial dates.
- [`app/api/pension/routes.test.ts`](../../app/api/pension/routes.test.ts): 401 without session, create and list, same-day replacement, validation, fund limit, update, cross-user isolation, deletes, import all-or-nothing.

## 7. Related

- [overview.md](overview.md), [net-worth.md](net-worth.md), [analytics-and-goals.md](analytics-and-goals.md), [taxes.md](taxes.md), [investments.md](investments.md)
- Spec: [`docs/superpowers/specs/2026-10-02-pensione-design.md`](../superpowers/specs/2026-10-02-pensione-design.md)
- Decisions: [`2026-10-08-pensione-stile-panoramica.md`](../decisioni/2026-10-08-pensione-stile-panoramica.md), [`2026-10-14-pianificazione-finanziaria-germania.md`](../decisioni/2026-10-14-pianificazione-finanziaria-germania.md)
