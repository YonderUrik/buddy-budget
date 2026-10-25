# BuddyBudget roadmap

All your money in one number you can trust: bank, investments, pension fund and loans together, with the rules of your country applied where they change the result. A rule we cannot apply correctly is shown as a limit, never guessed.

This file lists the direction. Each line links to its decision when there is one.

## Phase 1: Foundation (done)

- [x] Sign-in with email link and Google, onboarding with country, language and currency
- [x] Manual accounts and bank connection via Open Banking (GoCardless, read-only; new connections paused on the hosted version, [decision](docs/decisioni/2026-10-19-collegamento-banca-in-arrivo.md))
- [x] Panoramica (overview) with net worth by asset class over time
- [x] Self-hosted infrastructure: k3s on a VPS, GitOps, backups, observability ([decision log](docs/decision-log.md))

## Phase 2: Everyday money (done)

- [x] Transactions with split and exclusions, four spending groups, budget per category
- [x] Rules and AI-assisted categorisation, applied on its own from 70% confidence, and the bank's own categories from imported files ([decision](docs/decisioni/2026-10-19-categorie-della-banca-negli-import.md))
- [x] Subscriptions detected from transactions ([decision](docs/decisioni/2026-10-10-abbonamenti.md))
- [x] CSV import for any bank, with AI-written parsers ([guide](docs/personal-csv-import.md))
- [x] Summary and alert emails, all opt-in ([decision](docs/decisioni/2026-10-10-email-riepilogo-e-avvisi.md))
- [x] Monthly budget: what you can still spend, per category, with rollover ([decision](docs/decisioni/2026-10-22-budget-del-mese.md))
- [x] One «Add» button for the whole app ([decision](docs/decisioni/2026-10-24-pulsante-aggiungi.md))
- [x] One search for the whole app that answers questions about your data, and turns a typed sentence in Italian, English or German into a filled-in form ([decision](docs/decisioni/2026-10-25-cerca.md), [answers](docs/decisioni/2026-10-25-cerca-domande-e-loghi.md))

## Phase 3: Investments and Italian taxes (done)

- [x] ETFs, stocks, government bonds, funds and crypto with free end-of-day prices
- [x] Imports from Interactive Brokers, DEGIRO, Trade Republic and Fineco
- [x] Returns (TWR and XIRR), benchmark, risk, look-through diversification, dividends
- [x] Italian tax estimate, zainetto fiscale and the «Prima di vendere» (before selling) simulator
- [x] Security page with fundamental indicators, watchlist and price alerts

## Phase 4: Long-term planning (mostly done)

- [x] Debts: amortisation, APR (TAEG), early repayment, simulator
- [x] Pension fund and TFR
- [x] Analitiche: target year with «e se…» (what if) sliders, FIRE, Monte Carlo
- [x] Savings goals ([decision](docs/decisioni/2026-10-15-obiettivi-di-risparmio.md))
- [ ] Pianifica (plan): life scenarios such as buying a home or a job change

## Phase 5: More countries and devices (in progress)

- [x] Interface in Italian, English and German; Germany as a second product country with partial 2026 tax estimates ([decision](docs/decisioni/2026-10-14-pianificazione-finanziaria-germania.md)); every other country gets the features that do not depend on local rules ([decision](docs/decisioni/2026-10-19-lingua-e-funzioni-dal-paese.md))
- [x] Self-hosting with Docker ([guide](docs/self-hosting.md))
- [x] Public read-only demo without an account, English landing and `latest` Docker images ([decision](docs/decisioni/2026-10-17-demo-pubblica.md))
- [ ] Native iOS and Android apps on the App Store and Google Play, with push notifications and biometric unlock: **current focus**
- [ ] German pension and simulators after the product review

## Phase 6: Next

- [ ] More countries, one at a time: each country has its own taxes, pension system and banks, so a country is added only when its rules can be applied correctly (Italy first, Germany partly today)
- [ ] Shared accounts, to follow the net worth of a couple or a family together
- [ ] A small subscription for the hosted version at buddybudget.io, to cover servers and bank connections; self-hosting stays free under AGPL-3.0

## Consciously deferred

These are known gaps, kept out on purpose until there is a clear need:

- Multiple portfolios per user, lot-level tax reconstruction, foreign withholding taxes and tax return sections
- Real estate and other assets, multi-currency cash accounts
- Automatic Euribor updates and foreign-currency loans
- An assistant or MCP access to your own data

---

Ideas and feedback are welcome: open an [issue](https://github.com/YonderUrik/buddy-budget/issues) or write to support@buddybudget.io.
