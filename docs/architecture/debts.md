# Debts

The Debts engine turns a loan's initial conditions plus a log of events (payments, rate changes, balance corrections, early repayments) into a full instalment plan, today's remaining balance, interest totals, upcoming instalments and "what if" comparisons. Nothing derived is stored: every plan is rebuilt from the two tables on each request. The pure calculations live in [`lib/calc/`](../../lib/calc/) ([`amortization.ts`](../../lib/calc/amortization.ts), [`debt-plan.ts`](../../lib/calc/debt-plan.ts), [`early-repayment.ts`](../../lib/calc/early-repayment.ts), [`debt-simulator.ts`](../../lib/calc/debt-simulator.ts)); the domain glue (view, form logic, event checks, data access) lives in [`lib/debts/`](../../lib/debts/); the API is under [`app/api/debts/`](../../app/api/debts/).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Load | `userId` | `debts` and `debt_events` rows | [`lib/debts/data.ts`](../../lib/debts/data.ts) `loadUserDebts`, `findOwnDebt` |
| Map | DB rows | `DebtTerms` + `DebtPlanEvent[]` | [`lib/debts/view.ts`](../../lib/debts/view.ts) `toPlanTerms`, `toPlanEvent` |
| Segment schedule | principal, rate, count, first date | `ScheduleRow[]` | [`amortization.ts`](../../lib/calc/amortization.ts) `buildSegmentSchedule` |
| Plan | terms + events + today | `LoanPlan` (rows with status, totals, residual series, warnings) | [`debt-plan.ts`](../../lib/calc/debt-plan.ts) `buildLoanPlan` |
| View | all loans of the user | `DebtsViewData` (per-debt views, APR, aggregate overview) | [`view.ts`](../../lib/debts/view.ts) `buildDebtsView` |
| Overview insights | `DebtView[]` | yearly interest shares, exit plan | [`overview-insights.ts`](../../lib/debts/overview-insights.ts) |
| What if | plan + hypothesis | early repayment comparison, monthly extra, refinancing, payoff strategies | [`early-repayment.ts`](../../lib/calc/early-repayment.ts), [`debt-simulator.ts`](../../lib/calc/debt-simulator.ts) |
| Net worth | `DebtsViewData` | negative "debiti" rows per day | [`lib/net-worth/debt-history.ts`](../../lib/net-worth/debt-history.ts) (see [net-worth.md](net-worth.md)) |

```text
debts (terms) ─┐
               ├─> buildLoanPlan(terms, events, today) ─> LoanPlan ─> buildDebtsView ─> GET /api/debts
debt_events ───┘          │                                              │
                          └─ buildSegmentSchedule (one per segment)      ├─> Debiti overview and loan detail
                                                                         └─> net worth "debiti" history
```

## 2. Principles

**P1 — Conditions plus events, never a stored schedule.** The schedule, the residual and every total are computed by `buildLoanPlan` from `debts` and `debt_events`. Deleting an event (`DELETE /api/debts/[id]/events/[eventId]`) simply rebuilds the plan without it.

**P2 — Terms are immutable.** `updateDebtSchema` ([`lib/validation/debts.ts`](../../lib/validation/debts.ts)) accepts only `name` and `costs`. Changing the rate, the residual or the duration is done with events, so history is never rewritten.

**P3 — Pure calculations.** Everything in `lib/calc/*` and in `view.ts`, `overview-insights.ts`, `add-form.ts`, `early-repayment-form.ts` is pure: no DB access, and "today" is always passed in by the caller (`todayIso()` in [`lib/debts/dates.ts`](../../lib/debts/dates.ts), UTC).

**P4 — Instalments are marked by hand.** A `payment` event is only created by the user ("Segna pagata", "Mark as paid") or by the explicit bulk action. No cron or bank sync marks an instalment as paid, and a linked transaction is optional and chosen by hand.

**P5 — Payments do not change the plan.** The real amount of a payment is stored and summed in `paidTotal`, but the theoretical schedule ignores it. To realign the residual after a suspension or renegotiation the user records a `balance_correction`.

**P6 — Simulations never write.** `compareEarlyRepayment`, `simulateRecurringExtra`, `compareRefinance` and `simulatePayoff` return results only. An early repayment is persisted only when the user confirms it in the same dialog.

**P7 — Cent rounding with a closing last instalment.** Every amount is rounded to the cent per instalment (`round2`), and the last instalment absorbs the rounding difference so the residual ends at exactly zero.

## 3. Data model

Schema: [`lib/db/schema/debts.ts`](../../lib/db/schema/debts.ts). Enumerations are `text` columns typed by constants in [`lib/debts/constants.ts`](../../lib/debts/constants.ts), so new values need no migration.

**`debts`** — one row per loan.

| Column | Meaning |
|---|---|
| `kind` | `loan`. `credit_line` still exists in the type and in the columns below, but the feature was removed: `buildDebtsView` ignores such rows and `POST /api/debts` always writes `loan`. |
| `start_mode` | `nuovo` (new loan), `origine` (reconstructed from origination), `fotografia` (snapshot of today). |
| `principal` | Disbursed capital (`nuovo`/`origine`) or today's residual (`fotografia`). |
| `annual_rate` | Nominal annual rate (TAN, *tasso annuo nominale*) in percent, e.g. `6.5000`. |
| `installments` | Total instalments (`nuovo`/`origine`) or remaining ones (`fotografia`). |
| `first_installment_date` | First due date, or next due date for `fotografia`. Its day of month is the anchor day of the schedule. |
| `installment` | Instalment declared by the user; `null` means "use the computed one". |
| `anchor_date` | Date of the snapshot (only `fotografia`, required by validation). |
| `costs` | JSON array of `DebtCost { label, amount, kind: "una_tantum" \| "per_rata" }` (one-off or per-instalment). Max 10. |
| `credit_limit`, `spread`, `index_label`, `interest_frequency`, `day_count`, `capitalize_interest`, `alert_threshold_*` | Inert columns of the removed credit line. |

**`debt_events`** — the event log, cascaded on debt or user deletion. `user_id` is duplicated from the debt to filter by user without a join.

| `type` | Fields used | Effect on the plan |
|---|---|---|
| `payment` | `installment_number`, `date`, `amount`, optional `transaction_id` | Marks that row `pagata`. No effect on the schedule. A partial unique index `debt_events_payment_unique (debt_id, installment_number) WHERE type = 'payment'` allows one payment per instalment. |
| `rate_change` | `date`, `rate` | Opens a new segment at the new rate from the first instalment after `date`, same remaining count. |
| `balance_correction` | `date`, `amount` (real residual) | Opens a new segment from the first instalment after `date` with `amount` as principal, same remaining count. |
| `early_repayment` | `date`, `amount`, `penalty` (EUR), `effect` | Lowers the residual by `amount` and opens a new segment (see 4.6). |
| `draw`, `repay`, `interest_charged` | — | Credit-line types; rejected by validation and ignored by `toPlanEvent`. |

`note` is an `encryptedText` column. `transaction_id` references `transactions.id` with `ON DELETE SET NULL`.

Always computed, never stored: the schedule rows, their status, the residual today, interest to date and remaining, the end date, APR, the residual series, the overview totals and the net worth history.

## 4. How it works

### 4.1 Instalment (French amortisation)

Only the constant-instalment ("French") schedule exists: monthly, paid in arrears, interest per period = residual × rate / 12. There is no Italian (constant capital) or bullet schedule.

```text
i = annualRate / 1200
installment = P * i / (1 - (1 + i)^-n)        (i > 0)
installment = P / n                           (i = 0)
rounded to the cent
```

Example: 10,000 EUR at 6% over 12 instalments gives `installmentAmount(10000, 6, 12) = 860.66`.

### 4.2 Segment schedule

`buildSegmentSchedule` produces one row per instalment: `number`, `dueDate`, `installment`, `interest`, `capital`, `residual`.

```text
interest_k = round2(residual_{k-1} * annualRate / 1200)
capital_k  = round2(min(installment - interest_k, residual_{k-1}))     (not last)
capital_n  = residual_{n-1}                                            (last)
paid_n     = round2(residual_{n-1} + interest_n)                       (last)
dueDate_k  = addMonthsClamped(firstDueDate, k, anchorDay)
```

`addMonthsClamped` keeps the anchor day and clamps it to short months without overflowing: 31 Jan, 28 Feb, 31 Mar.

Example (10,000 EUR, 6%, 12 instalments, first due 2026-01-31):

| # | Due | Instalment | Interest | Capital | Residual |
|---|---|---|---|---|---|
| 1 | 2026-01-31 | 860.66 | 50.00 | 810.66 | 9,189.34 |
| 2 | 2026-02-28 | 860.66 | 45.95 | 814.71 | 8,374.63 |
| 12 | 2026-12-31 | 860.70 | 4.28 | 856.42 | 0.00 |

The last instalment is 860.70 because it absorbs the cent rounding.

### 4.3 The "missing variable" calculator

When adding a loan the user types three of principal, instalment, number of instalments and rate. `resolveMissingLoanInput` computes the fourth; with four it changes nothing; with two or more missing it throws a readable `AmortizationError`. The form logic in [`lib/debts/add-form.ts`](../../lib/debts/add-form.ts) (`resolveAddForm`) waits silently until three fields are filled (`MIN_FILLED_FIELDS = 3`) and parses Italian or English number formats (`parseAmount`).

| Missing | Solver | Method |
|---|---|---|
| instalment | `installmentAmount` | closed form (4.1) |
| rate | `solveAnnualRate` | bisection on the annual rate in [0, 100] % until `pmt(rate) = installment` (tolerance 1e-12, 200 iterations) |
| instalments | `solveInstallments` | simulates the cent-rounded plan and stops when `residual + interest ≤ installment × 1.01`; max 1,200 instalments |
| principal | `solvePrincipal` | closed form `installment × (1 - (1+i)^-n) / i` |

Guards: the rate solver rejects `installment × n < principal`; the instalment-count solver rejects an instalment that does not exceed the first month's interest. The 1% margin prevents a cent-rounded instalment from adding a whole extra instalment.

Example: 10,000 EUR, 860.66 EUR, 12 instalments → rate 5.999%; 10,000 EUR, 6%, 860.66 EUR → 12 instalments; 6%, 860.66 EUR, 12 → principal 9,999.95 EUR.

If the instalment was computed (not typed), `buildCreateDebtInput` does not send it, so `debts.installment` stays `null` and the plan keeps computing it. `previewAddForm` shows instalment, total interest and last due date before saving.

### 4.4 APR (TAEG)

`computeApr` returns the effective annual rate (TAEG, *tasso annuo effettivo globale*) of the real cash flows, costs included. One-off costs reduce the net amount received; per-instalment costs add to each payment.

```text
net     = principal - upfrontCosts
payment = installment + recurringCosts
find monthly m in [0, 1] such that  payment * (1 - (1+m)^-n) / m = net      (bisection)
APR     = ((1 + m)^12 - 1) * 100
```

Example: 10,000 EUR, 860.66 EUR × 12, no costs → APR 6.17% (the effective equivalent of a 6% nominal rate). With 200 EUR one-off and 2 EUR per instalment → APR 10.73%.

Where it is used:

- In the add form (`computeFormApr`) only for `nuovo`/`origine`; `null` for `fotografia`.
- In the view (`computeDebtApr` in `view.ts`) for every loan. For `fotografia` one-off costs are ignored and the result is the APR of what remains from today's residual. The instalment is the declared one, else the first plan row. Any `AmortizationError` yields `apr: null`.
- `weightedApr` in the overview: average of open loans' APR weighted by residual.

### 4.5 Building the plan from events

`buildLoanPlan(terms, events, today)`:

1. Builds the first segment from the terms (declared instalment if present).
2. Sorts the anchor events (`rate_change`, `balance_correction`, `early_repayment`) by date and applies them in that order, whatever order they arrived in. For each event, rows with `dueDate ≤ event.date` are frozen; the rest is replaced by a new segment that starts at the first unfrozen due date, keeps the anchor day and continues the numbering. An event after the last instalment is skipped with a warning.
3. Attaches `payment` events to rows by `installmentNumber`. A payment on a non-existent instalment or a second payment on the same one is ignored with a warning.
4. Assigns a status to each row:

| Status | Condition |
|---|---|
| `pagata` (paid) | a payment event exists |
| `da_pagare` (to pay) | not paid and `dueDate ≥ today` (an instalment due today is not overdue) |
| `da_confermare` (to confirm) | not paid, past due, and `startMode = origine` (reconstructed history) |
| `scaduta` (overdue) | not paid, past due, other start modes |

5. Computes the totals: `residual` (after the last instalment due on or before today, or after the latest applied early repayment if it is more recent; 0 if an early repayment closed the debt), `currentInstallment` (next future row), `interestToDate` and `interestRemaining` (split at today), `paidTotal` (sum of real payment amounts), `remainingInstallments`, `endDate`, `nextDueDate` (first `da_pagare` or `scaduta`), `overdueCount`, `unconfirmedCount`, `finished`, `penaltiesPaid` (only repayments dated on or before today) and `closedOn`.
6. Builds `residualSeries`: the principal one month before the first due date, one point per due date, one point per early repayment.

The residual follows the theoretical schedule, not the payments: an unpaid overdue instalment still lowers the residual.

Example: a 100,000 EUR loan at 4% over 240 instalments has an instalment of 605.98 EUR. A `rate_change` to 5% dated 2027-06-10 freezes the 17 instalments due up to 2027-05-31 and recomputes the remaining 223 from that residual at 5%, starting with the instalment due 2027-06-30.

### 4.6 Early repayment

An `early_repayment` event of amount `A` on date `d`:

```text
residualBefore = residual of the last instalment due on or before d (principal if none)
newPrincipal   = round2(residualBefore - A)
if newPrincipal <= 0: debt closed on d, later rows dropped, closedOn = d
reduce_installment: same remaining count, instalment recomputed on newPrincipal
reduce_duration:    same instalment, count = min(remaining, solveInstallments(newPrincipal, rate, instalment))
```

If `solveInstallments` fails for `reduce_duration`, the segment falls back to recomputing the instalment over the remaining count. Interest accrued between the last due date and `d` is not prorated: the repayment is applied to the residual of the last due date.

`compareEarlyRepayment` builds the baseline plan and the two alternatives and returns, for each: the next instalment, end date, remaining instalments, interest after `d`, `interestSaved = baselineInterest - interestAfter`, `netBenefit = interestSaved - penalty`, `monthsSaved` and `closesDebt`.

Example: 100,000 EUR at 4% over 240 instalments from 2026-01-31; repay 10,000 EUR on 2027-01-15 with a 100 EUR penalty.

| | Next instalment | End | Interest saved | Net benefit |
|---|---|---|---|---|
| Baseline | 605.98 | 2045-12 | — | — |
| Reduce instalment | 543.29 | 2045-12 | 4,292.12 | 4,192.12 |
| Reduce duration | 605.98 | 2043-03 (33 months earlier) | 10,225.05 | 10,125.05 |

The penalty can be typed in EUR or as a percentage of the amount (`resolvePenalty` in [`early-repayment-form.ts`](../../lib/debts/early-repayment-form.ts)). The same dialog previews the comparison and, on confirmation, posts the event. `checkEventApplicable` ([`lib/debts/events.ts`](../../lib/debts/events.ts)) rejects a repayment after the last instalment or on a debt already closed.

`simulateRecurringExtra` (the monthly mode of the early-repayment dialog, `previewEarlyRepayment`) adds an early repayment with `reduce_duration` and no penalty on every future due date and reports interest with and without, extra paid and months saved.

### 4.7 Refinancing (surroga)

`compareRefinance` compares the rest of the current loan with a new offer on today's residual (surroga: moving the mortgage to another bank).

```text
newInstallment = installmentAmount(residual, offer.rate, offer.n)
newInterest    = newInstallment * offer.n - residual
switchCosts    = offer.upfrontCosts + offer.penalty
netSaving      = currentInterestRemaining - newInterest - switchCosts
breakEven      = ceil(switchCosts / (currentInstallment - newInstallment))   only if both > 0
newEndDate     = today + offer.n months
```

Example: residual 100,000 EUR, current instalment 605.98 EUR and 45,435.21 EUR interest left; offer at 3% over 240 instalments with 1,000 EUR costs → new instalment 554.60 EUR, new interest 33,104 EUR, net saving 11,331.21 EUR, break-even after 20 months.

### 4.8 Payoff strategies (avalanche, snowball)

`simulatePayoff(loans, monthlyExtra, strategy, today)` is a whole-month estimate across several loans. Each month every open loan accrues interest and pays its instalment; then a pool (`monthlyExtra` plus the instalments of loans already closed) goes to the loan chosen by the strategy: `avalanche` = highest rate first, `snowball` = smallest balance first, `none` = no extra and no rollover. Constant rates and instalments, no penalties, at most 600 months (`MAX_PAYOFF_MONTHS`).

Example: loan A 10,000 EUR at 8% paying 300 EUR, loan B 2,000 EUR at 4% paying 100 EUR, extra 200 EUR/month → no extra: 38 months, 1,420.22 EUR interest; avalanche: 22 months, 841.98 EUR; snowball: 22 months, 892.92 EUR.

`comparePayoffStrategies` runs all three. In the UI only `none` and `avalanche` are shown; the snowball result is computed but not displayed.

### 4.9 «Priorità e azioni»: the Debiti overview

`/debiti` ([`app/(app)/debiti/page.tsx`](../../app/(app)/debiti/page.tsx)) is the "priorities and actions" overview. It has no tabs and reads one query, `GET /api/debts`:

| Block | Data | Code |
|---|---|---|
| Hero «Ancora da restituire» (still to repay) | `overview.totalDebt`, open count, latest end date | `DebtsHero` |
| «Prossime rate» (upcoming instalments) with "Segna pagata" | `overview.nextDue`: first unsettled row of each open loan, sorted by date, max 5 (`NEXT_DUE_LIMIT`) | `DebtsUpcomingCard`, `findDueRow` |
| «Dove paghi di più» (where you pay most) | `yearlyInterestShares`: `residual × annualRate / 100` per open loan, sorted, with share of total | `DebtsInterestCard` |
| «Come uscirne prima» (how to get out sooner) | `buildExitPlan`: avalanche vs none with a monthly extra slider; per loan the new and baseline closing date; `null` if a simulation hits 600 months | `DebtsExitCard` |
| «I tuoi debiti» (your debts) | list linking to `/debiti/finanziamenti?id=` | `DebtsListCard` |

The loan detail (`/debiti/finanziamenti`) shows the plan, the event log and the «E se…» ("What if…") panel with three options: more each month (`simulatePayoff` on one loan, `avalanche` vs `none`), one-off (opens the early-repayment dialog), surroga (`compareRefinance`). `/debiti/simulatore` redirects to `/debiti/finanziamenti`.

Aggregate overview (`buildDebtsView`): `totalResidual` and `totalDebt` (equal: sum of open loans' residual), `monthlyPayment` (sum of current instalments), `interestToDate` and `interestRemaining` (all loans, closed included), `debtFreeDate`, `openCount`, `weightedApr`, `nextDue`, and `residualSeries` (total residual from today to the last due date).

### 4.10 Marking instalments and linking transactions

- `POST /api/debts/[id]/events` with `type: "payment"` marks one instalment with real date and amount (prefilled from the plan). `checkEventApplicable` rejects a non-existent instalment or one already paid; the unique index is the last guard.
- `POST /api/debts/[id]/payments/bulk { upToInstallment }` marks in one go every unpaid row with `number ≤ upToInstallment` and `dueDate ≤ today`, with the plan's date and amount. The detail page uses it for the «Segna tutte come pagate» banner over `da_confermare` and `scaduta` rows.
- The optional linked transaction is picked from expenses within ±20 days of the due date (`TRANSACTION_SEARCH_WINDOW_DAYS` in `debt-transaction-picker.tsx`). `rankInstallmentCandidates` ([`transaction-candidates.ts`](../../lib/debts/transaction-candidates.ts)) puts exact-amount matches (within one cent) first, then sorts by distance in days, stable on ties. The route checks the transaction belongs to the user (`ownsTransaction`), otherwise 404.

### 4.11 API and ownership

| Route | Name (`withRoute`) | Purpose |
|---|---|---|
| `GET /api/debts` | `debts.list` | full `DebtsViewData` |
| `POST /api/debts` | `debts.create` | create a loan (`createDebtSchema`) |
| `PATCH /api/debts/[id]` | `debts.update` | name and costs only |
| `DELETE /api/debts/[id]` | `debts.delete` | delete with cascade |
| `POST /api/debts/[id]/events` | `debts.events.create` | add an event |
| `DELETE /api/debts/[id]/events/[eventId]` | `debts.events.delete` | remove an event |
| `POST /api/debts/[id]/payments/bulk` | `debts.payments.bulk` | mark past instalments |

Every query filters by `user_id`; a debt of another user answers 404, indistinguishable from a missing one. Validation limits: rate 0-100 %, 1-600 instalments, amounts up to 1e9, note up to 500 characters. Umami events from the UI: `debt_simulation_opened` (`kind`), `debt_exit_plan_used`, `debt_installment_transaction_linked`.

## 5. Limits and out of scope

- Only French amortisation with monthly instalments. No constant-capital, bullet, variable frequency or pre-amortisation.
- Rate changes are manual events: no automatic Euribor update, no mixed or capped rates, no foreign currency.
- Payments do not move the residual; a different real amount needs a `balance_correction`.
- Early repayments do not prorate interest accrued since the last due date.
- The payoff and "more each month" simulations use whole months, constant rates and no penalties: they compare options, they do not predict exact amounts.
- Snowball is computed but not exposed; strategy comparison in the overview is deferred.
- Credit lines (Lombard credit) were removed; their columns and enum values remain in the schema, inert.
- Terms of an existing debt cannot be edited from the UI (by design, see P2); debts cannot be reordered; informal debts and push reminders on due dates are deferred (CLAUDE.md "Consciously deferred").
- To verify by hand against real contracts: rate and APR, history from origination, penalties of a real early repayment.

## 6. Tests

| File | What it asserts |
|---|---|
| [`lib/calc/amortization.test.ts`](../../lib/calc/amortization.test.ts) | known instalment (10,000 EUR, 6%, 12 = 860.66), zero rate, month clamping, last row closes at zero, declared instalment, round-trip solvers, APR with and without costs, missing-variable resolution |
| [`lib/calc/amortization.properties.test.ts`](../../lib/calc/amortization.properties.test.ts) | 40 deterministic random scenarios (mulberry32): capital sums to principal, paid = principal + interest, residual non-increasing and ending at 0, dates increasing, solvers consistent (count within +1, rate within 0.02 points) |
| [`lib/calc/debt-plan.test.ts`](../../lib/calc/debt-plan.test.ts) | statuses per start mode, snapshot mode, rate change and correction segments, event order independence, warnings, totals consistency, instalment due today |
| [`lib/calc/early-repayment.test.ts`](../../lib/calc/early-repayment.test.ts) | both effects, full repayment closes the debt, today's residual after a repayment, penalties counted only when past, combination with a later rate change, comparison and monthly extra |
| [`lib/calc/debt-simulator.test.ts`](../../lib/calc/debt-simulator.test.ts) | refinance saving and break-even, payoff with and without extra, avalanche never pays more interest than snowball, snowball closes the smallest first |
| [`lib/debts/*.test.ts`](../../lib/debts/) | view aggregation, APR per mode and weighted APR, residual series, credit lines ignored; add-form parsing and resolution; penalty and preview; overview insights; transaction ranking |
| [`lib/db/schema/debts.integration.test.ts`](../../lib/db/schema/debts.integration.test.ts) | defaults, one payment per instalment, cascade on user deletion (real DB) |
| [`app/api/debts/routes.test.ts`](../../app/api/debts/routes.test.ts) | 401, the three start modes, validation, IDOR, payment rules, events past the end rejected, early repayment and closure, transaction ownership, delete cascade, bulk marking, no credit lines |

## 7. Related

- [overview.md](overview.md), [net-worth.md](net-worth.md) (debts as a negative asset class), [bank-sync-and-imports.md](bank-sync-and-imports.md) (transactions that can be linked), [analytics-and-goals.md](analytics-and-goals.md)
- Decisions: [`docs/decisioni/2026-10-05-debiti-priorita-e-azioni.md`](../decisioni/2026-10-05-debiti-priorita-e-azioni.md), [`docs/decisioni/2026-10-08-debiti-stile-panoramica.md`](../decisioni/2026-10-08-debiti-stile-panoramica.md), [`docs/decision-log.md`](../decision-log.md) (2026-09-30)
- Spec: [`docs/superpowers/specs/2026-09-30-debiti-design.md`](../superpowers/specs/2026-09-30-debiti-design.md)
