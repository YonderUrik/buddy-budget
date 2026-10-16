# Pensione: design (2026-10-02)

Status: implemented on branch `claude/project-thread-43tais`, awaiting a decision on production.

## Problem
Many providers (e.g. Moneyfarm PIP, an individual pension plan) show only two series: net contributions and market value. There is no list of contributions.

## Model
- `pension_funds` (name, joining date) and `pension_snapshots` (date, net contributions, market value; unique per fund+date).
- Contributions are the differences between consecutive snapshots; before the first snapshot the history is spread over quarters from the joining date and marked `estimated`.
- Pure computations in `lib/calc/pension.ts` (XIRR, exit taxes, withdrawal range, TFR (Italian severance pay) kept with the employer, projection, annual breakdown).

## Tabs
Panoramica (Overview), Andamento (Trend), Scenari (Scenarios: withdrawal today, fund vs TFR, taxes), Proiezione (Projection: 3 real-terms scenarios), I tuoi dati (Your data).

## Integrations
Net worth (`previdenza` class, derived history, not stored), sidebar, ZIP/JSON export, account reset, usage metrics, catalog/landing/login.

## Open assumptions (to validate)
Taxable base of the exit tax (hence a range), rules for TFR kept with the employer, "net contributions" net of costs, inflation fixed at 2%.

## Observability
`pension.*` events (Loki), Umami `pension_*` events, usage metrics in the "Utenti e utilizzo" ("Users and usage") dashboard. No cron/job/external dependency: no alert.
