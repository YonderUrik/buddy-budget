# BuddyBudget roadmap

## Vision

Help people see all of their money in one number they can trust: the bank, investments, pension fund and loans together, with the rules of the country they live in (Italy first) applied where they change the result.

## Strategy

1. **One picture, not five apps.** Every area (cash, investments, pension, debts, goals) feeds the same net worth, day by day.
2. **Local rules done properly.** Italian taxation, pension funds and TFR, bank connections that work with European banks. A rule we cannot apply correctly is shown as a limit, never guessed.
3. **Calculations you can check.** Every figure comes from a pure, tested function in [`lib/calc/`](lib/calc/) and is explained in [`docs/architecture/`](docs/architecture/).
4. **Read-only, and the user decides.** The app never moves money. Automation (rules, AI suggestions) is opt-in and always shows where a value came from.
5. **Finished, not half-done.** A feature ships with its observability, its landing entry and its documentation, or it does not ship.

## What we believe in

- **Your data is yours.** Full export, deletion, encrypted sensitive fields, open source code (AGPL-3.0) and a `docker compose` to host it yourself.
- **Plain language.** Screens speak to people who are not finance experts; the technical detail is one tap away for those who want it.
- **No advice.** Estimates and simulations inform; they are not financial or tax advice.

## Roadmap

The detailed, always up-to-date backlog is private (Slack). This file lists the direction; each line links to its decision when there is one.

### Phase 1: Foundation (done)

- [x] Sign-in with email link and Google, onboarding with country, language and currency
- [x] Manual accounts and bank connection via Open Banking (GoCardless, read-only)
- [x] Panoramica (overview) with net worth by asset class over time
- [x] Self-hosted infrastructure: k3s on a VPS, GitOps, backups, observability ([decision log](docs/decision-log.md))

### Phase 2: Everyday money (done)

- [x] Transactions with split and exclusions, four spending groups, budget per category
- [x] Rules and AI-assisted categorisation with a 90% auto-apply threshold ([decision](docs/decisioni/2026-10-12-categorizzazione-soglia-90.md))
- [x] Subscriptions detected from transactions ([decision](docs/decisioni/2026-10-10-abbonamenti.md))
- [x] CSV import for any bank, with AI-written parsers ([guide](docs/personal-csv-import.md))
- [x] Summary and alert emails, all opt-in ([decision](docs/decisioni/2026-10-10-email-riepilogo-e-avvisi.md))

### Phase 3: Investments and Italian taxes (done)

- [x] ETFs, stocks, government bonds, funds and crypto with free end-of-day prices
- [x] Imports from Interactive Brokers, DEGIRO, Trade Republic and Fineco
- [x] Returns (TWR and XIRR), benchmark, risk, look-through diversification, dividends
- [x] Italian tax estimate, zainetto fiscale and the «Prima di vendere» (before selling) simulator
- [x] Security page with fundamental indicators, watchlist and price alerts

### Phase 4: Long-term planning (mostly done)

- [x] Debts: amortisation, APR (TAEG), early repayment, simulator
- [x] Pension fund and TFR
- [x] Analitiche: target year with «e se…» (what if) sliders, FIRE, Monte Carlo
- [x] Savings goals ([decision](docs/decisioni/2026-10-15-obiettivi-di-risparmio.md))
- [ ] Pianifica (plan): life scenarios such as buying a home or a job change
- [ ] Separate Budget section with its own data model

### Phase 5: More countries and devices (in progress)

- [x] Interface in Italian, English and German; Germany as a second product country with partial 2026 tax estimates ([decision](docs/decisioni/2026-10-14-pianificazione-finanziaria-germania.md))
- [x] Self-hosting with Docker ([guide](docs/self-hosting.md))
- [x] Public read-only demo without an account, English landing and `latest` Docker images ([decision](docs/decisioni/2026-10-17-demo-pubblica.md))
- [ ] Native iOS and Android app (Capacitor), push notifications and biometric unlock
- [ ] German pension and simulators after the product review

### Consciously deferred

These are known gaps, kept out on purpose until there is a clear need:

- Multiple portfolios per user, lot-level tax reconstruction, foreign withholding taxes and tax return sections
- Real estate and other assets, multi-currency cash accounts
- Automatic Euribor updates and foreign-currency loans
- Sharing an account with a partner
- An assistant or MCP access to your own data

---

Ideas and feedback are welcome: open an [issue](https://github.com/YonderUrik/buddy-budget/issues) or write to support@buddybudget.io.
