# Debiti — design

Date: 2026-09-30. Status: **spec to be approved**, no code written. It comes from a brainstorming with the user (fixed-rate personal loan, Lombard credit line with variable drawdown and a Euribor-linked rate). Section 7 of `docs/functional-spec.md` (Debiti ("Debts") in the mockup) remains the reference for the original UI: here we decide what it becomes in the real product.

## 1. Goal

Track your debts, know how much they really cost and decide how to repay them: loans with an amortization schedule (mortgage, personal or car loan) and revolving credit lines (Lombard credit, overdraft facility). It must work both for debts **already under way** (with a past to reconstruct) and for debts **starting now**.

## 2. Principles

- **The schedule is not stored, it is computed.** Like positions in Investimenti (Investments): the source of truth is the initial conditions and an **event log**; schedule, outstanding balance and interest are derived.
- **"Ho fatto" and "e se" ("I did it" and "what if") are the same engine.** A hypothetical early repayment in the simulator and a real recorded one use the same computation; a simulation can be promoted to a real event.
- **The user decides.** Interest charging rules, alert thresholds, ancillary costs, real instalment amounts: always set by the user, the app only offers starting values.
- **Section independent of Transazioni (Transactions).** No automation: an instalment is marked as paid by hand. Linking to a transaction is optional and chosen by the user.
- **Investments are an extra, never a requirement.** Those with a portfolio in the platform get more information; those without use everything else.
- All amounts are in the user's currency (no foreign-currency debts in the first version).

## 3. Conceptual model

Two types of debt, with different behaviors:

| Type | How it behaves | Examples |
|---|---|---|
| `loan` | Principal, rate, term: amortization schedule with instalments | mortgage, personal loan, car loan |
| `credit_line` | Maximum facility, variable drawdown, daily interest on the balance | Lombard credit, overdraft, revolving card |

### 3.1 Loan

Basic data: name, principal disbursed, rate (TAN, the nominal annual rate), number of instalments, date of the first instalment, frequency (monthly for now), amortization type (French = constant instalment, default; Italian = constant principal share, to be evaluated), **costs** (arrangement fee, insurance, instalment collection fee: free items with an amount, one-off or per instalment, decided by the user).

**Fixed or variable rate**: the loan has a list of rate periods (`from date → rate`), so a rate change is an event like the others. Today's use case is a single fixed rate.

### 3.2 "Missing variable" calculator

In the creation form the user may not know one of the four quantities principal, instalment, number of instalments, rate. If three are provided, the app computes the fourth:

- principal + instalment + no. of instalments → **rate** (TAN) and, with the costs entered, **TAEG** (the Italian APR, including costs);
- principal + rate + no. of instalments → **instalment**;
- principal + rate + instalment → **no. of instalments** (rounded up, with a reduced last instalment);
- instalment + rate + no. of instalments → **principal** (how much was obtained, useful to understand an offer).

The rate is derived with a numerical method (bisection/Newton on the amortization function, pure and tested), the TAEG as the internal rate of return of the flows including costs. Derived quantities are shown as "calcolato" ("computed") and are editable, and it is noted that rounding of the real instalment can make the rate differ slightly. It is also used for the "debt under way" case (see 4) and for comparing offers in the simulator.

### 3.3 Credit line (Lombard credit)

Basic data: name, **maximum facility**, **rate** (index + spread, or fixed; the index is the Euribor at a tenor chosen by the user), opening date.

Charging rules **decided by the user** (the app proposes an editable default, no rule is hard-coded):
- frequency of interest charging (monthly, quarterly, other);
- day-count basis (360, 365, actual days);
- whether charged interest is added to the drawn capital (capitalization) or paid separately;
- any fixed fees (fee on the facility, on the undrawn amount).

The variable figure is the **drawn balance**, which changes over time: it is reconstructed from drawdown and repayment events. Interest accrues day by day on that day's balance, at the rate in force (index at the date + spread).

**Alert threshold**: set by the user independently (percentage of the facility or absolute amount). When the drawn amount exceeds it, the app flags it in the tab and in the overview. It is not tied to investments.

**Extra if there are investments** (optional, only with a portfolio in the platform and if the user links it): drawn/portfolio value ratio, cost of credit (effective rate) compared with the portfolio's return, effect of a market drop on the ratio. Never mandatory and never visible without linking.

### 3.4 Event log

| Event | Applies to | Fields |
|---|---|---|
| Instalment paid | `loan` | reference instalment, date, real amount, linked transaction (optional) |
| Early repayment | `loan` | date, amount, penalty (optional), effect: reduce the instalment or reduce the term |
| Rate change | `loan`, `credit_line` | effective date, new rate or new index value |
| Drawdown | `credit_line` | date, amount |
| Repayment | `credit_line` | date, amount |
| Interest charged | `credit_line` | date, real amount charged (to correct the estimate) |
| Balance correction | `loan`, `credit_line` | date, real outstanding balance (to realign after suspensions or renegotiations) |

An event is not edited by hand on the schedule: the event is edited or deleted and the schedule is recomputed.

## 4. Debts under way and new debts

When adding a loan the user chooses, with an explanation of each path:

- **New (from today)**: basic data, schedule entirely in the future.
- **Under way, rebuild from origination**: enters the original data (principal, rate, instalments, start date). The app generates the schedule and shows how many instalments have already passed. Past instalments start as "da confermare" ("to confirm"): the user marks them as paid in bulk ("tutte pagate fino a…" — "all paid up to…") or one by one, and can correct their amount and date.
  - Suitable when the contract data is available. The past is **computed**, hence "estimated" until confirmed, like the derived net worth history.
- **Under way, snapshot of today**: enters current outstanding balance, instalment, rate and remaining instalments (or, with calculator 3.2, any two of these). The app projects only the future, there is no history before that date.
  - Suitable when the contract is no longer available or has been modified. The outstanding balance is a "balance correction" event at today's date.

For the credit line the equivalent is the initial drawn balance (a drawdown event at the tracking start date) with no obligation to reconstruct the past.

## 5. Early repayments: "ho fatto" and "e se"

- **Recorded** (real event): the user enters date, amount and penalty. Before confirming, the app shows **the two alternatives side by side**: *reduce the instalment* (same end date, lower instalment) and *reduce the term* (same instalment, ends earlier), with interest saved and new end date for each. The schedule is recomputed from the event date and earlier instalments stay frozen.
- **Simulated** (no event saved): same computation with hypothetical amount and date, also recurring (e.g. "extra di 100 € al mese" — "extra €100 a month"), with the effect on total interest. A "Registra come fatto" ("Record as done") button converts the simulation into a real event.
- Penalty: free field (in euros or as a percentage of the amount), included in the cost/benefit comparison.

## 6. Interface: tabs like the other groups

`/debiti` entry with tabs on their own URLs, same `SectionTabs` mechanism used by Movimenti (Transactions) and Investimenti:

1. **Panoramica** ("Overview", `/debiti`): total debt (outstanding principal of loans + drawn amount of lines), overall monthly instalment, interest paid so far and estimated from here to the end, debt-free date, Lombard alert if above threshold, upcoming due dates, chart of the outstanding balance over time.
2. **Finanziamenti** ("Loans", `/debiti/finanziamenti`): one card per loan, detail with the amortization schedule instalment by instalment (principal, interest, balance, status), instalments markable as paid, event log, "Registra estinzione anticipata" ("Record early repayment") button, selector to view each one's schedule (fix of the mockup stub).
3. **Lombard** (`/debiti/lombard`): per line, drawn vs facility, rate in force, interest accrued in the month and estimate at the current balance, average drawdown, trend of the drawn amount, log of drawdowns/repayments, rate changes, threshold; extra section with investments if linked.
4. **Simulatore** ("Simulator", `/debiti/simulatore`): recurring or one-off early repayment, comparison with a surroga (mortgage portability/refinancing) offer (net savings minus costs), Euribor rise scenario on the credit line, avalanche/snowball comparison across several debts.

Shared dialogs in the layout: "Aggiungi debito" ("Add debt", with new/under-way choice and calculator 3.2), "Registra evento" ("Record event").

## 7. Integrations

- **Net worth**: new asset class `debiti` (negative) in the rows of `net_worth_snapshots` (`text` column, no schema change). Outstanding balance of loans and drawn amount of lines enter Panoramica; the past history is rebuilt from events with the same mechanism as `refreshDerivedInvestmentHistory` (fingerprint on Redis, rewriting only the changed days). To be evaluated with the user whether the "Dove sta il tuo patrimonio" ("Where your wealth is") card shows debts as a separate row.
- **Transazioni**: no dependency. Optional link transaction ↔ instalment/event: a `transactionId` field on the event, chosen by the user from a picker; no automatic change to the transaction's category or amount.
- **Euribor**: in the first version the user updates the index by hand ("rate change" event). An automatic update of the index (like €STR from the `market-prices` cron) is evaluated later, choosing a reliable free source: to be verified, not taken for granted.
- **Investimenti**: read-only access to portfolio value and return, only for the extra information in the Lombard tab.
- Sidebar and login: when the screen exists, remove `comingSoon` from `NAV_ITEMS` and remove the entry from `UPCOMING_FEATURES` (see CLAUDE.md).

## 8. Architecture (reuse of existing patterns)

- Pure logic in `lib/calc/` (`amortization.ts`: schedule, missing-variable solver, TAEG; `credit-line.ts`: daily interest, charging rules; `debt-events.ts`: applying events to the schedule). All testable without a DB, like `lib/calc/returns.ts`.
- Planned tables (final schema in the plan): `debts` (type, name, parameters, start mode), `debt_events` (event log with date, type, amounts, optional `transactionId`), credit line settings (charging rules, threshold, in Phase 3). A rate change is a `rate_change` event, with no dedicated table (Phase 1 plan, 2026-09-30). A loan's schedule is a sequence of segments, each with an anchor (date, balance, rate, remaining instalments) opened by initial conditions, rate change, balance correction or (Phase 2) early repayment. Versioned migration via `db:generate`, per the project rule.
- Routes with `withRoute("debts.<action>", …)` and `bindRequestUser`, categorical Umami events (`debt_added`, `debt_event_added`, …) via `track()`, logs without amounts or names, per the observability standard. Account export and reset include the new tables.
- Recomputation operations are light (schedules of a few hundred rows): synchronous computation in the request, no background job.

## 9. Phases

1. **Engine and loans**: schedule computation, missing-variable calculator, event log, new/under-way modes, instalments marked by hand, Panoramica and Finanziamenti tabs.
2. **Early repayments** real and simulated, with the "reduce instalment / reduce term" comparison.
3. **Lombard**: credit line, drawdowns and repayments, index + spread rate, user charging rules, threshold, Lombard tab.
4. **Integrations and full simulator**: `debiti` class in net worth with derived history, extras with investments, surroga, Euribor scenario, avalanche/snowball, Simulatore tab.

Each phase is a PR of its own. Phase 3 can start in parallel with 2 because the event engine belongs to 1.

## 10. Decisions made and deferred

**Decided** (brainstorming 2026-09-30): debts under way with an explained choice between rebuilding from origination and today's snapshot; instalments only in the schedule, marked by hand, optional link to transactions; Lombard from the start; early repayment both real ("ho fatto") and simulated ("e se"); Lombard charging rules, loan costs and alert threshold decided by the user; threshold independent of investments; missing-variable calculator; tabbed interface.

**Deferred** (to be picked up after Phase 4): automatic Euribor update; foreign-currency debts; "Italian-style" amortization if not needed right away; mortgages with mixed rate or cap; informal debts without a rate (loans between people) as a dedicated type; push notifications on due dates; split in Cash flow between principal share and interest share (today the whole instalment counts as an expense, a choice to revisit together with Transazioni); import of the schedule from a bank document.

## 11. To verify with the user at build time

Exact rules of their own Lombard (frequency, day basis, capitalization) and of the loan (costs, insurance, early repayment penalty) from the contract; whether the starting data of past instalments match the theoretical schedule, otherwise use the balance correction.
