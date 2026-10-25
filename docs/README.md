# BuddyBudget documentation

Pick the section that matches what you want to do. The guides and [`architecture/`](architecture/) describe the code as it is today. Decisions, specs and plans are history: if one disagrees with the code, the code wins.

## Use and host BuddyBudget

| Document | What it covers |
| --- | --- |
| [Self-hosting](self-hosting.md) | Docker Compose installation, what works without external services, HTTPS, updates, backups |
| [Staging](staging.md) | Staging server setup, deployment, email, AI and recovery |
| [Personal CSV import](personal-csv-import.md) | Importing a bank or broker CSV in any format, with AI-written parsers |
| [Interactive Brokers import](ibkr-import.md) | Which statements to export and how they are reconciled |
| [DEGIRO import](degiro-import.md) | `Account.csv` import and its limits |
| [Trade Republic import](trade-republic-import.md) | Supported exports and limits |

## Understand how it works

Start from the [architecture overview](architecture/overview.md), then open the area you need. Each page follows the same shape: overview, principles, data model, how each calculation works (with a worked example), limits, tests.

| Area | Document |
| --- | --- |
| The whole system: layers, request lifecycle, data, security, «Aggiungi» and «Cerca» | [architecture/overview.md](architecture/overview.md) |
| Background jobs and scheduled tasks (cron) | [architecture/background-jobs.md](architecture/background-jobs.md) |
| Bank connection (Open Banking) and imports | [architecture/bank-sync-and-imports.md](architecture/bank-sync-and-imports.md) |
| Categories, rules, AI suggestions, budgets, subscriptions | [architecture/categorisation.md](architecture/categorisation.md) |
| Investments: positions, returns, risk, dividends | [architecture/investments.md](architecture/investments.md) |
| Prices, exchange rates, inflation and other market data | [architecture/market-data.md](architecture/market-data.md) |
| Italian (and partial German) taxation | [architecture/taxes.md](architecture/taxes.md) |
| Pension fund and TFR | [architecture/pension.md](architecture/pension.md) |
| Debts: amortisation, APR, early repayment, simulator | [architecture/debts.md](architecture/debts.md) |
| Net worth over time | [architecture/net-worth.md](architecture/net-worth.md) |
| Analitiche (FIRE, Monte Carlo) and savings goals | [architecture/analytics-and-goals.md](architecture/analytics-and-goals.md) |

Rules every contributor follows (component layers, observability, background jobs, performance, design tokens) are in [`CLAUDE.md`](../CLAUDE.md). Infrastructure, monitoring and runbooks are in the [infra repository](https://github.com/YonderUrik/buddy-budget-infra).

## Contribute

| Document | What it covers |
| --- | --- |
| [Contributing](../CONTRIBUTING.md) | Workflow, checks to run, conventions |
| [Releases](rilasci.md) | Conventional Commits PR titles, release-please, deploy |
| [Landing screenshots](landing-screens.md) | How the screenshots on the website are generated from the real app |
| [Accessibility](../ACCESSIBILITY.md) | Accessibility status and checklist |
| [Security policy](../SECURITY.md) | How to report a vulnerability |

## Product and history

| Document | What it covers |
| --- | --- |
| [Product vision](product-vision.md) | What BuddyBudget is for and for whom |
| [Roadmap](../ROADMAP.md) | Direction, what is done and what is deferred |
| [Decisions](decisioni/) | One file per decision since 2026-10-04 (`YYYY-MM-DD-title.md`) |
| [Decision log archive](decision-log.md) | Decisions up to 2026-10-03 |
| [Changelog](../CHANGELOG.md) | What changed in each version |
| [Specs and plans](superpowers/) | Working notes written while each feature was built |

## Writing documentation

- English, plain and precise. Italian product and tax terms keep their name with a short English gloss the first time (for example zainetto fiscale, the tax-loss carryforward).
- A living document states what the code does, cites the files and functions that do it as relative links, and gives a worked example with numbers for every calculation.
- Say what a feature does **not** do. A limit stated in the docs is better than one found by a user.
- When you change behaviour described in [`architecture/`](architecture/), update that page in the same pull request. When you make a choice worth remembering, add a new file in [`decisioni/`](decisioni/).
