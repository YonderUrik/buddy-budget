# Analitiche (advanced tools): design

Status: implemented on branch `claude/project-thread-idnurb` (PR under review). Original research plan: Claude Doc "Piano sezione Analitica (FIRE e patrimonio)" ("Analytics section plan (FIRE and net worth)"), later narrowed at the user's request.

## Goal and principles

A section for those who want to "tinker": FIRE, scenarios, risk and costs. Three rules decided by the user:

1. **Advanced analyses only.** Nothing that can already be derived from Panoramica (Overview), Movimenti (Transactions), Investimenti (Investments), Pensione (Pension).
2. **Everything explained.** Each analysis has what it means, how to read it, how it's computed, limits and sources; a guide on the first visit; no number without context.
3. **Visible to everyone.** Sidebar entry always present (user's choice, 2026-10-03: no toggle, «se qualcuno vuole entrare entra» — "if someone wants to go in, they go in"); those not interested don't go there.

## Tabs

| Tab | Content | Engine |
| --- | --- | --- |
| Obiettivo FIRE (FIRE target) | FIRE number (gross and net of latent taxes), progress, years to target, lean FIRE, Coast FIRE, two sensitivity tables | `lib/calc/fire.ts`, `liquidation.ts` |
| Simulazione (Simulation) | Monte Carlo of net worth (accumulation + retirement), probability of success, 10th-90th percentile bands | `lib/calc/monte-carlo.ts` |
| Prelievi (Withdrawals) | fixed, percentage, Guyton-Klinger (simplified), Vanguard dynamic on the same scenarios | `monte-carlo.ts` (`compareRules`) |
| Crescita (Growth) | change in financial net worth = savings + market/other (by difference) | `growth-split.ts` |
| Rischio (Risk) | volatility, maximum drawdown, Sharpe, Sortino, Calmar, 95% VaR/CVaR, concentration, risk contribution (Euler) | `risk-extras.ts`, `risk.ts` |
| Costi e tasse (Costs and taxes) | TER (entered by hand) + bollo (stamp duty), erosion over 30 years, tax if everything is sold | `costs.ts`, `liquidation.ts` |

## Data and assumptions

- No new source: `lib/analitiche/base.ts` composes, client-side, accounts, transactions of the last 13 months, net worth snapshots, investments (`useInvestmentsOverviewQuery("max")`), pension and debts.
- Assumptions in `analytics_assumptions` (one row per user, JSON validated with zod in `lib/analitiche/assumptions.ts`, invalid fields fall back to the default). Prudent starting values: 3.5% withdrawal, 4% real return, 12% volatility, 2% inflation, 40 years of retirement, fixed rule.
- Spending and savings are derived from the last 12 full months if there are at least 3 months of data; otherwise nothing is made up and the tab asks the user to enter them.
- API: `GET/PUT /api/analytics/assumptions`, `POST /api/analytics/walkthrough` (all `withRoute`).

## Simulation model (choices)

Annual step, lognormal real returns with arithmetic mean `r` and volatility `σ`; mulberry32 generator with a seed per path, so the four rules see the same markets. Optional state pension: from the chosen year it reduces the withdrawal and the rule restarts from the new level. Guyton-Klinger thresholds (±20% bands, 10% adjustments, no cuts in the last 15 years) and Vanguard limits (−2.5% / +5%) from the literature, declared "simplified". Known limits: independent returns without fat tails, no historical source.

## Knowingly deferred

- Long historical datasets (backtests on real series, bootstrap, sequence stress, factors): licenses (e.g. JST is CC BY-NC-SA) and weight; to be picked up if usage justifies it.
- Automatic TER from Yahoo (today entered by hand), optimization of the selling order, currency exposure, glidepath, saving several named scenarios.
- Grafana "Analitiche usage" panel in the infra repo (the Umami `analytics_*` events already exist).

## Observability

Logs: `analytics.assumptions.saved` (fields changed), `analytics.walkthrough.seen`. Umami: `analytics_tab_viewed`, `analytics_assumptions_saved`, `analytics_guide_closed`, `analytics_guide_reopened`, `analytics_explainer_opened`. No background job, cron or external dependency: no metric or alert.
