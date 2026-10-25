# Analytics and savings goals

Analitiche (Analytics, route `/analitiche`) turns the user's balances, transactions, investments and a small set of saved assumptions into four answers: how far along the user is towards financial independence (the FIRE number), the year they can stop working, whether their wealth would last through retirement (Monte Carlo), and what the portfolio costs. The «Obiettivi» view (Goals, `/analitiche/obiettivi`) reuses the same figures to plan named savings goals funded by labelled portions of accounts and investments. The domain logic lives in [`lib/analitiche/`](../../lib/analitiche/), the pure calculation engines in [`lib/calc/fire.ts`](../../lib/calc/fire.ts), [`lib/calc/monte-carlo.ts`](../../lib/calc/monte-carlo.ts), [`lib/calc/growth-split.ts`](../../lib/calc/growth-split.ts) and [`lib/calc/liquidation.ts`](../../lib/calc/liquidation.ts), and the goals logic in [`lib/goals/`](../../lib/goals/). Note that [`lib/analytics/`](../../lib/analytics/) is unrelated: it holds the Umami product events (`track()`).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Assumptions | `analytics_assumptions.data` (JSON) | `AnalyticsAssumptions` with defaults filled in | [`lib/analitiche/assumptions.ts`](../../lib/analitiche/assumptions.ts) `resolveAssumptions`, `mergeAssumptions` |
| Data period | `dataPeriod` + today | whole-month date range | [`lib/analitiche/period.ts`](../../lib/analitiche/period.ts) `resolvePeriodRange` |
| Base figures | balances, transactions, categories, investments, pension funds, debts, net worth snapshots | `AnalyticsBase` (wealth, annualised cash flow, positions, risk, growth points, historical return) | [`lib/analitiche/base.ts`](../../lib/analitiche/base.ts) `buildAnalyticsBase` |
| Expected return | assumptions + historical TWR | return in use and its source | [`lib/analitiche/historical-return.ts`](../../lib/analitiche/historical-return.ts) `historicalReturn`, `resolveExpectedReturn` |
| Plan | base + assumptions | spending, savings, FIRE number net of latent tax, years to FIRE, coast numbers | [`lib/analitiche/plan.ts`](../../lib/analitiche/plan.ts) `resolvePlan` |
| «e se…» sliders | plan + slider overrides | scenario plan (not saved) | [`lib/analitiche/scenario.ts`](../../lib/analitiche/scenario.ts) |
| Simulation | plan + assumptions | Monte Carlo bands, success rate per withdrawal rule | [`lib/analitiche/simulation.ts`](../../lib/analitiche/simulation.ts), [`lib/calc/monte-carlo.ts`](../../lib/calc/monte-carlo.ts) |
| Server snapshot | user id | base + plan + essential spending, read once | [`lib/analitiche/snapshot.ts`](../../lib/analitiche/snapshot.ts) `loadAnalyticsSnapshot` |
| Server digest | snapshot, input fingerprint | what the sidebar FIRE module and the Goals view need, cached on Redis | [`lib/analitiche/digest.ts`](../../lib/analitiche/digest.ts) `loadAnalyticsDigest` |
| Goals view | `goals`, `goal_sources`, snapshot | per-goal value, savings plan, FIRE shift, free sources | [`lib/goals/view.ts`](../../lib/goals/view.ts), [`lib/goals/plan.ts`](../../lib/goals/plan.ts) |
| Goal reminders | goals view + sent keys | alert / monthly reminder / digest section | [`lib/notifications/goals.ts`](../../lib/notifications/goals.ts) |

```text
accounts, transactions, investments, pension, debts, snapshots
        |                                   analytics_assumptions (JSON)
        v                                              |
  buildAnalyticsBase  <---- dataPeriod ----------------+
        |                                              |
        v                                              v
  historicalReturn --> resolveExpectedReturn --> assumptions in use
        |                                              |
        +--------------------> resolvePlan <-----------+
                                   |
            +----------------------+-----------------------+
            v                      v                       v
   sliders (applyScenario)   buildSimulationInput     goalsViewFrom
            |                      |                       |
       resolvePlan            runMonteCarlo /         buildGoalsPlan
       (in browser)           compareRules            (+ monthsToFire)
```

The page computes everything in the browser: [`lib/analitiche/analytics-context.tsx`](../../lib/analitiche/analytics-context.tsx) assembles the inputs from the existing TanStack queries (accounts, transactions, investments, pension, debts, snapshots) and calls the same `buildAnalyticsBase` and `resolvePlan`. Server consumers (sidebar FIRE module in [`lib/sidebar/fire.ts`](../../lib/sidebar/fire.ts), the goals API, notification emails) call `loadAnalyticsDigest`, which runs `loadAnalyticsSnapshot` (the same pure functions on the server, so the figures match) and caches the result (§4.17).

## 2. Principles

**P1 — Pure engines.** Every calculation (`fire.ts`, `monte-carlo.ts`, `growth-split.ts`, `liquidation.ts`, `resolvePlan`, `buildGoalsPlan`, `buildGoalsView`, `findGoalNotice`) is a pure function: same inputs, same output, no database or network access. Database reads are confined to `lib/analitiche/data.ts`, `lib/analitiche/snapshot.ts`, `lib/goals/data.ts` and `lib/goals/server.ts`.

**P2 — Real terms throughout.** All money in Analitiche is in today's euros. The expected return is a real return (net of inflation), so `fire.ts` and the Monte Carlo engine never inflate spending.

**P3 — Computed, never stored.** Only the assumptions and the goals with their assigned portions are stored. Spending, savings, FIRE number, years to FIRE, goal progress, arrival dates and FIRE shifts are recomputed on every read from current balances and prices.

**P4 — Data first, assumptions override.** Spending and savings come from the user's transactions in the chosen data period unless the user typed a figure (`annualSpending` / `annualSavings` non-null). Every figure carries its origin (`FigureSource`: `ipotesi`, `dati`, `manca`; `ReturnSource`: `storico`, `prudente`, `manuale`) so the UI can label it «Dai tuoi dati» or «Inserito a mano».

**P5 — Invalid saved values never break the page.** `resolveAssumptions` validates each saved field on its own with the Zod schema; a field that no longer validates falls back to its default.

**P6 — Deterministic simulation.** `runMonteCarlo` uses a seeded PRNG (mulberry32) with one derived seed per path; `compareRules` runs all rules on identical random paths (common random numbers), so differences between rules are not luck.

**P7 — Sliders do not save.** The four «e se…» sliders are local overrides (`ScenarioOverrides`); they are written to the assumptions only when the user explicitly saves.

**P8 — Goal portions are labels.** A `goal_sources` row marks part of an account or position as belonging to a goal. Real balances are never moved or changed.

## 3. Data model

| Table | Stored | Code |
|---|---|---|
| `analytics_assumptions` | One row per user: `data` (JSONB, the assumptions object), `walkthrough_seen_at`, timestamps. No columns per assumption: they are never queried by value. | [`lib/db/schema/analytics.ts`](../../lib/db/schema/analytics.ts) |
| `goals` | `name` (encrypted text), `kind` (`emergenza`, `viaggio`, `casa`, `acquisto`, `altro`), `target_amount`, `target_date` (first day of the month, nullable), `monthly_amount`, `priority` (0 = first), `achieved_at`. | [`lib/db/schema/goals.ts`](../../lib/db/schema/goals.ts) |
| `goal_sources` | `goal_id`, exactly one of `account_id` / `instrument_id` (check constraint `goal_sources_one_target`), `amount`. Unique per goal and account, and per goal and instrument. Cascades on delete of the goal, account or instrument. | [`lib/db/schema/goals.ts`](../../lib/db/schema/goals.ts) |

The assumptions object (`assumptionsSchema`) and its defaults (`DEFAULT_ASSUMPTIONS`):

| Field | Default | Limits | Meaning |
|---|---|---|---|
| `withdrawalRate` | 0.035 | 0.01–0.10 | Safe withdrawal rate for the FIRE number |
| `dataPeriod` | `{ kind: "ultimi", months: 12 }` | 12 or 24 months, or custom 3–120 months | Period the data figures come from |
| `annualSpending` | `null` | 0–1e8 | `null` = from data |
| `annualSavings` | `null` | 0–1e8 | `null` = from data |
| `expectedReturn` | 0.04 | −0.02–0.50 | Real annual return (fallback when automatic) |
| `expectedReturnAuto` | `true` | — | Derive the return from history |
| `volatility` | 0.12 | 0–0.60 | Annual standard deviation for Monte Carlo |
| `inflation` | 0.02 | −0.02–0.15 | See section 4.9 |
| `retirementYears` | 40 | 5–70 | Years of retirement to cover |
| `rule` | `fissa` | `fissa`, `percentuale`, `guyton-klinger`, `vanguard` | Selected withdrawal rule |
| `includePensionFunds` | `false` | — | Count supplementary pension funds in wealth |
| `includeLatentTax` | `true` | — | Gross up the FIRE number for latent capital gains tax |
| `publicPension` | `null` | annual 0–1e8, starts after 0–60 years | State pension offset in the simulation |
| `terByInstrument` | `{}` | 0–0.05 each | Fund TER per instrument, entered by the user |

Assumptions saved before `expectedReturnAuto` existed are migrated on read: automatic only if the saved return equals the default 0.04. `mergeAssumptions` sets `expectedReturnAuto: false` whenever an update writes `expectedReturn` without saying otherwise.

Always computed, never stored: the whole `AnalyticsBase` and `AnalyticsPlan`, the goals' `current`, `progress`, `funded`, `etaMonth`, `status`, `fireShiftMonths`, and the free part of each account or position.

## 4. How it works

### 4.1 Data period and annualised cash flow

`resolvePeriodRange` turns the period into whole months. The current (partial) month never counts: «ultimi 12» ends at the end of last month and starts 12 months earlier; a custom period that reaches the current month stops at the previous one. `analyticsTransactionsRange` loads transactions from the earlier of the period start and 13 months ago (the growth chart always needs the last 12 months plus the current one).

`buildAnalyticsBase` builds the monthly income/expense series with `computeMonthlySeries` (effective amounts after «Dividi», so transfers whose `excludedAmount` equals the amount count as zero) and annualises from the first month with data, so a user who started recording mid-period is not averaged over empty months.

```text
coveredMonths = months from the first month with income or expenses to the end of the period
annualX       = sum(X over period) * 12 / coveredMonths        for X in {income, spending}
annualSavings = annualIncome - annualSpending
savingsRate   = annualSavings / annualIncome                   (null without income)
```

Example: period of 12 months, data only in the last 6, with 15,000 income and 9,000 spending in total. `annualIncome = 30,000`, `annualSpending = 18,000`, `annualSavings = 12,000`, savings rate 40%.

`cashflowFromData` uses these figures only when `monthsWithData >= MIN_MONTHS_FOR_CASHFLOW` (3); otherwise spending and savings are `manca` and the page asks the user to type them.

Lean spending is `annualSpending * leanShare`, where `leanShare` is the share of expenses in the Dovute (needs) and Saltuarie (occasional) groups. It is `null` when more than 25% of spending is uncategorised.

### 4.2 Expected return: history or by hand

`historicalReturn` computes the portfolio's time-weighted return (`computePortfolioReturns`, so contributions and withdrawals are not gains) over the data period, or from the first investment transaction if that is later, and annualises it. It returns a reason instead of a number when:

| Reason | Condition |
|---|---|
| `nessun-investimento` | no investment transactions |
| `prezzi-mancanti` | at least one instrument has no price |
| `patrimonio-basso` | current portfolio value below 1,000 |
| `periodo-breve` | chosen window shorter than 350 days (365 minus 15 days of grace) |
| `storico-breve` | investing for less than 350 days within the window, or no TWR |

For «ultimi N» the return window runs from today minus N months to today (calendar days, not whole months). The real return uses observed inflation (`returns.real`) when the price index covers the period, otherwise `realReturn(nominal, assumptions.inflation)`.

`resolveExpectedReturn` picks the value in use:

```text
if not expectedReturnAuto:   value = expectedReturn               source = manuale
elif no usable history:      value = 0.04 (default)                source = prudente
else:                        value = round(clamp(historyReal, -0.02, 0.50), 3 decimals)
                                                                    source = storico
high = value > 0.08          (warning only, never blocks)
```

`withExpectedReturn` substitutes this value into the assumptions before `resolvePlan`, both in the browser context and in `loadAnalyticsSnapshot`.

### 4.3 Wealth considered

```text
wealth = liquidity (sum of account balances) + investments value
         + pension funds value      (only if includePensionFunds)
```

Debts are loaded (`base.wealth.debts`) but are not subtracted from the FIRE wealth.

### 4.4 FIRE number net of taxes

`fireNumber` and `fireNumberAfterTax` in [`lib/calc/fire.ts`](../../lib/calc/fire.ts):

```text
grossNumber = annualSpending / withdrawalRate
latentTax   = sum over positions of max(0, unrealizedGain) * taxRate     (computeLiquidation)
taxShare    = min(latentTax / wealth, 0.99)    if includeLatentTax and wealth > 0, else 0
target      = grossNumber / (1 - taxShare)
progress    = wealth / target
```

The tax rate per position comes from the investment tax settings (0.26 by default, 0.125 for government bonds). Losses are not offset against gains and the zainetto fiscale (tax-loss carry-forward) is not used. For a product country without Italian tax rules (`DE` and `OTHER`, where `features.taxes` is false) `buildAnalyticsBase` gets `capitalGainsTax: false`: every rate is 0, so latent tax, `taxShare` and the goals' tax deduction are 0, and the screens drop the «sell everything today» card, the «Conta le imposte sulle plusvalenze» toggle and the stamp duty lines (`CostSummary.stampDuty`). Germany therefore sees Analitiche without German taxes (`overview.md` §4.8).

Example: spending 30,000, withdrawal rate 3.5%: gross number 857,142.86. Wealth 200,000 (50,000 cash, 150,000 investments with 40,000 unrealised gain at 26%): latent tax 10,400, `taxShare = 0.052`, target `857,142.86 / 0.948 = 904,159.13`, progress 22%.

### 4.5 Years to FIRE and the target year

`yearsToTarget` uses the closed form for compound growth with end-of-year contributions:

```text
P = wealth, c = annual savings (null treated as 0), r = real return, T = target
r == 0:  n = (T - P) / c                         (null if c <= 0)
r != 0:  n = ln((T*r + c) / (P*r + c)) / ln(1 + r)
n = 0 if P >= T; null if non-finite, negative or > MAX_PLANNING_YEARS (80)
```

The headline year shown by [`scenario-headline.tsx`](../../components/domain/analytics/scenario-headline.tsx) is `currentYear + ceil(n)`.

Example (from 4.4, savings 20,000, r = 4%): `n = ln((904,159.13*0.04 + 20,000) / (200,000*0.04 + 20,000)) / ln(1.04) = 17.75` years; in 2026 the headline says 2044.

`coastNumber(target, r, years) = target / (1 + r)^years` is computed for `COAST_HORIZONS` = 10, 15, 20, 25, 30 years. For 20 years in the example: 412,646.

### 4.6 «e se…» sliders

The four slider fields are `annualSavings`, `annualSpending`, `expectedReturn`, `withdrawalRate` (`SCENARIO_FIELDS`). `scenarioSlider` gives their ranges:

| Field | Range | Step |
|---|---|---|
| `expectedReturn` | −2% to 50% | 0.1 pt |
| `withdrawalRate` | 2% to 6% | 0.1 pt |
| `annualSpending` | 0 to roundUp(max(2 × baseline, 12,000), 500) | 100 |
| `annualSavings` | 0 (or roundDown(2 × baseline, 500) if negative) to roundUp(max(2 × abs(baseline), 12,000), 500) | 100 |

The money sliders are hidden when the baseline is missing. [`scenario-view.tsx`](../../components/domain/analytics/scenario-view.tsx) applies the overrides (`applyScenario`), re-runs `resolvePlan` in the browser, and recomputes the Monte Carlo comparison on a `useDeferredValue` copy so dragging stays smooth. `yearsToFireWith` gives the effect of a single slider with wealth and `taxShare` unchanged. The headline compares the scenario's years to FIRE with the saved plan («N anni prima/dopo delle ipotesi salvate»).

### 4.7 Monte Carlo simulation

`buildSimulationInput` maps the plan to `MonteCarloInput` and returns `null` without positive spending:

| Input | Value |
|---|---|
| `startingWealth` | `max(0, plan.wealth)` |
| `annualSavings` | `max(0, plan.savings)`: negative savings are not withdrawn during accumulation |
| `accumulationYears` | 0 for «Smetto oggi»; `min(ceil(yearsToFire), 40)` for «Smetto al traguardo FIRE» |
| `retirementYears`, `volatility`, `inflation`, `rule`, `publicPension` | from the assumptions |
| `expectedReturn` | the return in use (4.2) |

`runMonteCarlo` in [`lib/calc/monte-carlo.ts`](../../lib/calc/monte-carlo.ts):

- **Distribution.** Annual gross returns are lognormal with arithmetic mean `1 + r` and standard deviation `sigma`:
  ```text
  variance = ln(1 + (sigma / (1 + r))^2)
  mu = ln(1 + r) - variance / 2,  sd = sqrt(variance)
  growth = exp(mu + sd * Z),  Z ~ N(0,1) via Box-Muller
  ```
  With r = 4% and sigma = 12%: mu = 0.0326, sd = 0.1150.
- **Runs and seed.** `paths` defaults to `DEFAULT_PATHS` = 3,000 (clamped to 1–10,000); `seed` defaults to 1. The UI passes neither, so every simulation uses 3,000 paths and seed 1. Path `i` uses `mulberry32(pathSeed(seed, i))`.
- **Step.** Yearly. Accumulation: `wealth = max(0, wealth * growth + annualSavings)`. Retirement: withdraw at the start of the year, then apply growth.
- **Ruin.** A path is ruined when wealth reaches 0, or, for `fissa`, when the withdrawal could not cover the full need. Once ruined, wealth stays 0.
- **Public pension.** From retirement year `startsAfterYears`, the pension is added to spending and the withdrawal need drops by that amount; the adaptive rules rebase their previous withdrawal and rate at that year.

What it reports (`MonteCarloResult`): `successRate` (share of non-ruined paths), `wealth` percentile bands p10/p25/p50/p75/p90 for every year from today, `ruinByYear` (cumulative ruin share per retirement year), `spending` bands p10/p50/p90 per retirement year (withdrawal plus pension), `endingWealth` p10/p50/p90, and `maxCut` (median and p90 of the largest spending cut relative to the first year). Percentiles use linear interpolation.

### 4.8 Withdrawal rules

`rate0 = need0 / wealth at retirement`, where `need0` is spending minus any pension already active in year 0. `prev` is the previous year's withdrawal.

| Rule | Withdrawal in year k (k > 0) | Constants |
|---|---|---|
| `fissa` (fixed) | `annualSpending - pension` every year | — |
| `percentuale` (percentage) | `rate * wealth` | — |
| `guyton-klinger` (simplified) | `prev`, or `prev / (1 + inflation)` after a negative year when the current rate is above `rate0`; then −10% if the rate exceeds `rate0 * 1.2` and more than 15 years remain, +10% if it is below `rate0 * 0.8` | `GK_BAND` 0.2, `GK_ADJUSTMENT` 0.1, `GK_NO_CUT_LAST_YEARS` 15 |
| `vanguard` (dynamic spending) | `rate0 * wealth`, clamped to `[prev * 0.975, prev * 1.05]` | `VANGUARD_FLOOR` 0.025, `VANGUARD_CEILING` 0.05 |

Year 0 always withdraws `need0` for the adaptive rules. Every withdrawal is capped at current wealth. Because `percentuale` withdraws a fraction of what is left, it practically never reaches zero: its success rate measures sustainability, while `maxCut` shows the price in spending cuts. `compareRules` runs all four rules on the same paths; [`plain-answers.ts`](../../components/domain/analytics/plain-answers.ts) `lastingAnswer` reports the selected rule's success and names a better rule only if it beats it by more than 0.5 points.

### 4.9 Inflation handling

- All projections are in real terms; spending is never indexed.
- `assumptions.inflation` converts a nominal historical return into a real one when observed inflation does not cover the window (4.2).
- In Monte Carlo it is used only by Guyton-Klinger's «skip the inflation adjustment after a negative year», which in real terms is a real cut of `1 / (1 + inflation)`.

### 4.10 «Per esperti» details

Each of the four questions ([`analytics-questions.ts`](../../components/domain/analytics/analytics-questions.ts): `dove-sono`, `quando`, `reggera`, `costi`) ends with a collapsible «Per esperti» section ([`question-section.tsx`](../../components/domain/analytics/question-section.tsx)):

| Question | Expert content | Engine |
|---|---|---|
| Quanta strada ho fatto? (How far have I come?) | Growth split month by month | `splitGrowth` |
| Quando posso smettere? (When can I stop?) | Sensitivity tables, Coast FIRE, lean FIRE | `sensitivityByRateAndReturn`, `sensitivityBySpendingAndSaving`, `coastNumber`, `fireNumber(leanSpending)` |
| Reggerà? (Will it last?) | Monte Carlo bands with «Smetto oggi / al traguardo», rule comparison, portfolio risk | `runMonteCarlo`, `compareRules`, risk extras |
| Quanto mi costa? (What does it cost?) | TER per fund (user-entered), bollo (stamp duty), cost drag, latent tax | `summarizeCosts`, `costDrag`, `computeLiquidation` |

Growth split ([`lib/calc/growth-split.ts`](../../lib/calc/growth-split.ts)) uses month-end financial wealth (liquidity + investments, from `buildNetWorthSeries` over one year) and the month's savings:

```text
delta_m       = netWorth_m - netWorth_(m-1)
fromSavings_m = income_m - expenses_m
fromMarket_m  = delta_m - fromSavings_m        (residual: includes anything not in transactions)
savingsShare  = totalFromSavings / totalDelta  (null if totalDelta <= 0)
```

Example: wealth 100,000 then 103,000, savings 1,000 that month: delta 3,000, 1,000 from savings, 2,000 from market/other.

Sensitivity grids: the first grid sets the withdrawal rate at −1, −0.5, 0, +0.5 and +1 point around the current rate (floored at 1%) against the real return at −2, −1, 0, +1 and +2 points; the second grid varies spending and savings by −20%, −10%, 0, +10%, +20%. In the second grid a change in spending also moves savings by the same amount (`saving = annualSaving * (1 + savingChange) - (spending - annualSpending)`).

### 4.11 Assumptions persistence

`GET /api/analytics/assumptions` returns `resolveAssumptions(row.data)` plus `walkthroughSeen`. `PUT` validates a partial update with `updateAssumptionsSchema` (each field validated, empty objects rejected), merges it with `mergeAssumptions`, and upserts the full object (`saveAssumptions`). It logs `analytics.assumptions.saved` with the number of changed fields, plus `analytics.return_source.changed` and `analytics.data_period.changed` when those change. `POST /api/analytics/walkthrough` sets `walkthrough_seen_at`. Both routes are blocked outside Italy by `withCountryGuard` (see [`lib/localization/config.ts`](../../lib/localization/config.ts) `isCountryPathAvailable`).

### 4.12 Savings goals: value of a goal

`buildGoalsView` sorts goals by `priority`, then `createdAt`. Each account and position starts with a pool equal to its balance or value (floored at 0); goals higher in the list take from the pool first.

```text
gross      = min(assigned amount, what is left of the account or position)
taxPerEuro = (unrealizedGain / value) * taxRate     for positions with a gain; 0 for accounts
tax        = round2(gross * taxPerEuro)
counted    = round2(gross - tax)
short      = gross < assigned amount               (account gone or worth less)
current    = sum of counted over the goal's sources
```

Example: a position worth 10,000 with 2,000 unrealised gain at 26% has `taxPerEuro = 0.052`. Assigning 5,000 counts 4,740 (260 estimated tax). The remaining 5,000 is shown as free for other goals.

### 4.13 Savings goals: monthly plan by priority

`buildGoalsPlan` in [`lib/goals/plan.ts`](../../lib/goals/plan.ts). The monthly capacity is `plan.savings / 12` from the Analitiche plan (`null` when savings are unknown, in which case every goal gets its full quota).

```text
for each open goal, in priority order:
  wanted   = max(0, monthly)
  funded   = min(wanted, available);  available -= funded
  required = remaining / max(1, monthsLeft)        (only with a target month)
  monthsToGo = ceil(remaining / funded)            (null if funded = 0)
  etaMonth = current month + monthsToGo            (linear: no growth, no interest)
gap = max(0, sum(wanted) - max(0, capacity))
```

| Status | Condition |
|---|---|
| `raggiunto` (reached) | marked achieved, or `remaining <= 0.005` |
| `fermo` (stalled) | receives nothing this month |
| `senza_data` (no date) | funded, no target month |
| `in_linea` (on track) | `monthsToGo <= monthsLeft` |
| `in_ritardo` (late) | `monthsToGo > monthsLeft` |

Example: capacity 1,666.67 (20,000 a year). Goals in order: emergency fund (target 15,000, current 9,000, 500 a month), trip (3,000, current 0, 400 a month, by June 2027), car (20,000, 1,000 a month). Funded: 500, 400, 766.67; gap 233.33. In October 2026 the trip needs 8 months at 400 and has 8 left: `in_linea`, `required = 375`. The emergency fund arrives in 12 months (`senza_data`), the car in 27 months.

The emergency fund suggestion comes from `essentialSpendingFrom` ([`lib/goals/essential.ts`](../../lib/goals/essential.ts)): the monthly average of Dovute + Saltuarie expenses over the last 12 closed months, from the first month with expenses (the current month counts only when it is the only one); all expenses are used instead when more than 25% are uncategorised or there are no essential ones. The form proposes 3, 6 or 12 months of it (`EMERGENCY_MONTH_CHOICES`).

### 4.14 Savings goals: shift of the FIRE target

When the Analitiche plan has both a target and savings, goals are compared with the FIRE target. `monthsToFire` simulates monthly:

```text
monthlyReturn = (1 + realReturn)^(1/12) - 1
wealth_k = wealth_(k-1) * (1 + monthlyReturn) + annualSavings / 12 - withdrawals[k]
first k with wealth_k >= target;  null after GOAL_HORIZON_MONTHS (600)
```

A goal whose money is spent (every kind except `emergenza`, see `KEPT_GOAL_KINDS`) is modelled as a withdrawal of its full `target` in its arrival month. `fireShiftMonths = monthsToFire(with that single withdrawal) - baseMonths`; an open emergency fund always shifts 0. `fire.withGoalsMonths` applies all spending goals together. The view converts both to calendar years (`baseYear`, `withGoalsYear`).

Example (figures from 4.4 and 4.13): base 212 months; the trip moves the target by 1 month, the car by 8.

### 4.15 Goal API, ordering and reminders

- `GET /api/goals` returns `loadGoalsView` (snapshot + rows). `POST` creates a goal (max `MAX_GOALS` = 20, max 12 sources) at the requested position or at the end, shifting the others. `PATCH /api/goals/[id]` updates fields, replaces all sources when `sources` is sent, and sets or clears `achieved_at`. `DELETE` re-compacts priorities. `POST /api/goals/reorder` requires the full list of the user's goal ids and rewrites `priority` by index (409 on a stale list). Sources are checked for ownership: accounts by `user_id`, instruments by having at least one investment transaction of the user.
- Reminders ([`lib/notifications/goals.ts`](../../lib/notifications/goals.ts) `findGoalNotice`), opt-in via `goalAlertsEnabled`, sent by the notifications cron:
  - **reached**: a goal with `status = raggiunto` not yet marked achieved, once (`goal:<id>:raggiunto`);
  - **deadline**: target month between the start of this month and today + 30 days (`GOAL_DEADLINE_LEAD_DAYS`) and status not `in_linea`, once per target date;
  - **monthly reminder**: on days 1–3 of the month (`GOAL_REMINDER_MAX_DAY`, Europe/Rome date) with all open goals, capacity and gap, once per month.
- The periodic summary email gets `buildGoalsDigest`: open and late counts and the goal closest to its target. The Panoramica section shows the `OVERVIEW_GOALS` = 3 closest goals.

### 4.16 Cash-flow analysis (Liquidità)

Two engines outside Analitiche share the monthly series:

- [`lib/calc/cashflow.ts`](../../lib/calc/cashflow.ts) powers the «Analisi» tab of Liquidità. `computeCashflowKpis` gives monthly average income and expenses, where the current month counts pro rata (`day / daysInMonth`), the period's total net flow and the savings rate `net / income`. `computeMonthlySeries`, `computeAccumulatedSavings`, `computeIncomeSources` and `computeWhereItGoes` feed the charts. Periods are `3mesi`, `6mesi`, `12mesi`, `24mesi`, ending at the reference month. All use effective amounts after «Dividi».
- [`lib/calc/month-pace.ts`](../../lib/calc/month-pace.ts) `computeMonthPace` compares this month's spending so far with the average of the same stretch (up to the same day, clamped in short months) of the previous 3 months (`MONTH_PACE_LOOKBACK`) that had expenses, and returns daily cumulative curves, income and budget use (spending only on budgeted categories).

Example: on 15 March, spent 900 so far; the first 15 days of December, January and February cost 1,000, 800 and 900: `typicalSoFar = 900`, on pace.

### 4.17 Server digest cache

The server snapshot reads every account, transaction, investment operation, price, pension fund and debt of the user and runs the whole plan: about one second for a user with investments, and it blocks the pod while it runs. Panoramica asks for it twice at once (`/api/sidebar/fire` and `/api/goals`). [`lib/analitiche/digest.ts`](../../lib/analitiche/digest.ts) keeps on Redis only what those two need (`AnalyticsDigest`: accounts, positions with tax rate, monthly capacity, FIRE input, essential spending, debts, sidebar figures), under `analytics:digest:<userId>` with a 30-minute TTL.

An entry is used only when its fingerprint matches `analyticsInputsFingerprint`, computed on every request with a few aggregate queries: the cash history markers (`cashInputsFingerprint`: accounts, transactions), the investment history markers (`investmentInputsFingerprint`: operations, manual prices, closes, exchange rates), an md5 of every row of the small tables (assumptions, categories, debts and events, pension funds and snapshots, instrument settings, tax carryforwards, portfolios, dismissed dividends, broker sources and statements), currency, country and today's date. Any edit, import, sync or new close changes it. Inputs outside it (inflation index, dividends, instrument metadata) are picked up by the TTL. Parallel calls for the same user in one pod share one computation (`inFlight`). The goals themselves are always read fresh, so creating or reordering a goal shows at once.

Example: Panoramica opens, both requests arrive together; the first computes (miss, ~1 s), the second joins it (shared). On the next page the fingerprint is unchanged and both answer from Redis (hit, a few tens of ms). After a new transaction the transactions marker changes and the next request computes again.

## 5. Limits and out of scope

- Debts are not subtracted from FIRE wealth and loan payments are not modelled separately; they are only part of spending when they appear as expense transactions.
- The latent-tax gross-up uses one overall `taxShare` (latent tax over total wealth, cash included); losses are not offset and the zainetto fiscale is ignored ([`lib/calc/liquidation.ts`](../../lib/calc/liquidation.ts)).
- Monte Carlo is a lognormal i.i.d. model with a user-chosen mean and volatility: no historical backtest, bootstrap, sequence stress, fat tails or glidepath. Seed and path count are fixed in the UI. These deferred items are listed in CLAUDE.md under Analitiche.
- TER is not read from any data source; the user types it per instrument.
- The FIRE number has one spending figure; spending in retirement is not split from today's spending, and a single data period drives spending, savings and return.
- Goals: arrival dates are linear (no growth of the money set aside); pension funds and debts cannot be goal sources or goals; there is no automatic history of a goal's progress and no chart of the path (deferred, see `docs/decisioni/2026-10-15-obiettivi-di-risparmio.md`).
- Goals use monthly compounding with a 50-year horizon (`GOAL_HORIZON_MONTHS` 600), while the Analitiche headline uses the annual closed form with an 80-year limit. The goals' `baseYear` can therefore differ slightly from the Analitiche year, and is `null` when FIRE is between 50 and 80 years away.
- Germany and `OTHER` see Analitiche and goals without capital gains tax and stamp duty (`features.retirement` is `true` in [`lib/localization/financial-country.ts`](../../lib/localization/financial-country.ts); the dedicated German retirement screens stay hidden by `PLANNING_AVAILABILITY`). Goal emails are skipped for users whose country cannot see `/analitiche/obiettivi`.

## 6. Tests

| File | What it asserts |
|---|---|
| [`lib/calc/fire.test.ts`](../../lib/calc/fire.test.ts) | FIRE number, tax gross-up, `yearsToTarget` against a year-by-year simulation, zero-return and never-reached cases, coast number |
| [`lib/calc/monte-carlo.test.ts`](../../lib/calc/monte-carlo.test.ts) | Deterministic PRNG per seed, percentile interpolation, lognormal mean preservation, zero-volatility determinism, ruin monotonicity, accumulation, public pension effect, adaptive vs fixed rules |
| [`lib/calc/analytics-extras.test.ts`](../../lib/calc/analytics-extras.test.ts) | `splitGrowth`, risk extras (Sortino, Calmar, VaR/CVaR, risk contributions), costs and latent tax |
| [`lib/analitiche/assumptions.test.ts`](../../lib/analitiche/assumptions.test.ts) | Defaults, per-field fallback, update limits, automatic-return migration and manual override |
| [`lib/analitiche/period.test.ts`](../../lib/analitiche/period.test.ts) | Whole-month ranges, custom limits, loaded range, annualisation from the first month with data, transfers ignored |
| [`lib/analitiche/historical-return.test.ts`](../../lib/analitiche/historical-return.test.ts) | TWR over 12/24 months and custom windows, start at first purchase, observed inflation, missing reasons, clamp and warning |
| [`lib/analitiche/plan.test.ts`](../../lib/analitiche/plan.test.ts) | Spending/savings from data, FIRE net of latent tax, user figures override data, minimum months, pension funds opt-in |
| [`lib/analitiche/scenario.test.ts`](../../lib/analitiche/scenario.test.ts), [`simulation.test.ts`](../../lib/analitiche/simulation.test.ts) | Slider ranges, overrides, `yearsToFireWith`; simulation input for «oggi» and «fire», negative savings |
| [`lib/analitiche/digest.test.ts`](../../lib/analitiche/digest.test.ts) | Fingerprint stable without changes and different after account, transaction, category, assumptions and day changes; cache hit, recompute after a change, shared parallel computation, answer with a broken cache |
| [`lib/goals/plan.test.ts`](../../lib/goals/plan.test.ts), [`essential.test.ts`](../../lib/goals/essential.test.ts) | Month helpers, priority allocation, statuses, FIRE shift only for spent goals; essential spending basis and window |
| [`lib/notifications/goals.test.ts`](../../lib/notifications/goals.test.ts) | Monthly reminder once, reached and deadline alerts, email content, digest |
| [`components/domain/analytics/plain-answers.test.ts`](../../components/domain/analytics/plain-answers.test.ts) | Plain-language answers for the four questions |
| [`lib/calc/cashflow.test.ts`](../../lib/calc/cashflow.test.ts), [`month-pace.test.ts`](../../lib/calc/month-pace.test.ts) | Period ranges, KPIs with effective amounts; month pace curves, missing history, budget scope |

`lib/goals/view.ts` (source pooling and tax per source) has no dedicated test file.

## 7. Related

- [overview.md](overview.md), [net-worth.md](net-worth.md), [investments.md](investments.md), [taxes.md](taxes.md), [pension.md](pension.md), [debts.md](debts.md), [categorisation.md](categorisation.md), [background-jobs.md](background-jobs.md)
- Decisions: [`2026-10-09-analitiche-cursori.md`](../decisioni/2026-10-09-analitiche-cursori.md), [`2026-10-12-analitiche-periodo-dei-dati.md`](../decisioni/2026-10-12-analitiche-periodo-dei-dati.md), [`2026-10-15-obiettivi-di-risparmio.md`](../decisioni/2026-10-15-obiettivi-di-risparmio.md), [`2026-10-15-obiettivi-correzioni.md`](../decisioni/2026-10-15-obiettivi-correzioni.md), [`2026-10-17-obiettivi-mese-senza-crash.md`](../decisioni/2026-10-17-obiettivi-mese-senza-crash.md)
- Spec (may be outdated): [`docs/superpowers/specs/2026-10-03-analitiche-design.md`](../superpowers/specs/2026-10-03-analitiche-design.md)
