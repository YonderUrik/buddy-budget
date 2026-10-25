<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-full-white.svg">
  <img src="public/brand/logo-full-navy.svg" alt="BuddyBudget" width="320">
</picture>

<p>Open source personal finance: bank accounts, investments, debts and pension in one net worth, with Italian tax rules applied where they change the result.</p>

[![CI](https://github.com/YonderUrik/buddy-budget/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/YonderUrik/buddy-budget/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/YonderUrik/buddy-budget?label=release)](https://github.com/YonderUrik/buddy-budget/releases/latest)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

[Live demo, no sign-up](https://app.buddybudget.io/demo?lang=en) · [Website](https://buddybudget.io/en) · [Self-hosting](docs/self-hosting.md) · [Documentation](docs/README.md) · [Roadmap](ROADMAP.md)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/YonderUrik/buddy-budget/screenshots/dark/panoramica-top.webp">
  <img src="https://raw.githubusercontent.com/YonderUrik/buddy-budget/screenshots/light/panoramica-top.webp" alt="Overview: net worth over time, split into cash, investments, pension and debts">
</picture>

## Why

Most people who track their money use three tools: an app for expenses, a spreadsheet for investments, another one for the mortgage. BuddyBudget puts them in one app and one net worth.

- It only reads your data and never moves money.
- Every number comes from a tested function in [`lib/calc/`](lib/calc/), and [`docs/architecture/`](docs/architecture/overview.md) shows how each one is calculated, with a worked example.
- You can export or delete everything, or host it yourself with Docker.

## What it does

- **Overview**: net worth over time across cash, investments, pension and debts.
- **Cash**: accounts, transactions imported from any bank's CSV or Excel file, categories with rules and optional AI suggestions, a monthly budget that says what you can still spend, subscriptions detected from transactions.
- **Investments**: ETFs, stocks, bonds, funds and crypto with free end-of-day prices; imports from Interactive Brokers, DEGIRO, Trade Republic and Fineco; returns (TWR and XIRR) against a benchmark; risk, diversification inside ETFs, dividends and an Italian tax estimate before you sell.
- **Debts**: amortisation, APR, early repayment and payoff simulations.
- **Pension**: Italian pension fund and TFR (severance pay): real return and what you would get today, net of tax.
- **Analytics**: the year you could stop working, with sliders to try other savings, spending and returns; savings goals.
- **Search**: one search for the whole app that also answers questions («how much did I spend on Netflix in 2026») and turns a typed sentence («spent €12 on coffee») into a filled-in form.

The interface is in English, Italian and German. Tax and pension rules are Italian; Germany has a partial 2026 tax estimate, and other countries get everything except the pension and the tax screens. The full feature list is in [`lib/features/catalog.ts`](lib/features/catalog.ts), the same file the website reads.

> [!NOTE]
> Estimates and simulations are for information only, not financial or tax advice. The tax and pension rules have not yet been reviewed by a professional.

## Run it

### Self-hosted, with Docker

```bash
git clone https://github.com/YonderUrik/buddy-budget.git
cd buddy-budget
./scripts/selfhost-init.sh --start   # guided setup, then starts and waits until ready
```

It starts the app, Postgres, Redis and the scheduled jobs from the public images on ghcr.io. Email, Google sign-in, AI and bank connection are optional. [`docs/self-hosting.md`](docs/self-hosting.md) covers HTTPS, updates, backups and arm64.

### Local development

You need Node 24, [pnpm](https://pnpm.io), Postgres and Redis.

```bash
pnpm install
cp .env.local.example .env.local   # every variable is explained there
pnpm db:migrate
pnpm demo:seed                     # optional: a fictitious user with sample data
pnpm dev                           # http://localhost:3000
```

Before a pull request: `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm test` (on an empty, migrated database).

## How it is built

Next.js (App Router) and TypeScript, Postgres with Drizzle, better-auth, TanStack Query, Tailwind CSS with shadcn/ui, Recharts, Redis for background jobs, Vitest. The architecture rules every contributor follows are in [`CLAUDE.md`](CLAUDE.md) (it is also the guide for the AI coding assistant used in development).

```
app/          routes: sign-in, app screens, API and cron
components/   ui/ primitives · layout/ page structure · domain/ components per area
lib/          domain logic per area · calc/ pure, tested calculations · db/ schema and migrations
landing/      the website, a separate Next.js project
docs/         architecture, guides and the decisions behind them
```

## Status

Beta, built mostly by one developer with an AI coding assistant. On the hosted version new bank connections are paused (existing ones keep working): import a CSV instead. Next steps are in the [roadmap](ROADMAP.md).

## Contributing and contacts

- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md); for a large change, open an issue first.
- Vulnerabilities: follow [`SECURITY.md`](SECURITY.md), not a public issue.
- Hosted service: support@buddybudget.io, privacy@buddybudget.io.
- If it helps you, you can [buy me a coffee](https://buymeacoffee.com/yonder).

## License

[AGPL-3.0-only](LICENSE). If you offer a modified version as a network service, you must make its source available to its users under the same license. Keep the notices in [`NOTICE`](NOTICE).
