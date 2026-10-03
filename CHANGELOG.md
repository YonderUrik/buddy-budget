# Changelog

Tutte le modifiche rilevanti di BuddyBudget, versione per versione. Il file è mantenuto da release-please (vedi `docs/rilasci.md`).

## [0.4.1](https://github.com/YonderUrik/buddy-budget/compare/v0.4.0...v0.4.1) (2026-10-03)


### Correzioni

* **deps:** bump the patch group with 12 updates ([#116](https://github.com/YonderUrik/buddy-budget/issues/116)) ([39b5adb](https://github.com/YonderUrik/buddy-budget/commit/39b5adb46ad936c5b2036feee08a0c604c8ddff1))

## [0.4.0](https://github.com/YonderUrik/buddy-budget/compare/v0.3.0...v0.4.0) (2026-10-03)


### Novità

* **pensione:** import delle fotografie da CSV o Excel ([#95](https://github.com/YonderUrik/buddy-budget/issues/95)) ([689f1b8](https://github.com/YonderUrik/buddy-budget/commit/689f1b8fc418d2ebb98ec72658ea88b37ff498c6))

## [0.3.0](https://github.com/YonderUrik/buddy-budget/compare/v0.2.0...v0.3.0) (2026-10-03)


### Novità

* **investments:** add Interactive Brokers statement backend ([#99](https://github.com/YonderUrik/buddy-budget/issues/99)) ([ad4fe8c](https://github.com/YonderUrik/buddy-budget/commit/ad4fe8c4d3cd3083bc10522666d9c93979123edc))
* **investments:** scelta del provider nell'import (Interactive Brokers, Yahoo Finance, altro CSV) ([#101](https://github.com/YonderUrik/buddy-budget/issues/101)) ([a14b1f5](https://github.com/YonderUrik/buddy-budget/commit/a14b1f573eb1ed0699e02fdbc4ff37bc6dca2429))

## 0.2.0 — 2026-10-03

Prima versione numerata. Prima di questa data l'app riportava sempre `0.1.0` e ogni deploy si riconosceva solo dall'hash del commit; non è stata ricostruita una storia retroattiva. Questa release è il punto di partenza: comprende tutto ciò che c'era su `main` (conti e Open Banking, movimenti e categorie, investimenti, debiti, pensione, impostazioni, osservabilità, landing). Lo storico completo resta nelle PR chiuse e in `docs/decision-log.md`.
