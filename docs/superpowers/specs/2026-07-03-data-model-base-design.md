# Base data model: Accounts, Categories, Transactions, Budgets

**Date**: 2026-07-03
**Status**: approved

## Context

First spec of the application layer after the infra plan was paused (`docs/superpowers/plans/2026-07-03-infra-foundation.md`, paused: we decided to start from the application code before building cluster/CI-CD). It defines the Postgres/Drizzle schema for the fundamental entities that almost every screen depends on: accounts, spending categories, transactions, monthly budget.

The decisions build on what was already verified interactively in the mockup and documented in `docs/functional-spec.md` (sections "Conti" and "Spese", plus "Implicazioni per il modello dati reale" at the bottom of the document).

## What this spec covers

- Drizzle ORM + Postgres setup for local development.
- Schema for: `users` (stub), `categories`, `accounts`, `transactions`, `budgets`.

## What it does NOT cover (decided consciously, see the "Out of scope and future" section at the bottom)

- Real authentication, investments/securities, debts, pension, real estate, Pianifica scenarios, automatically detected subscriptions.
- Any UI: this spec only produces the data schema, not the screens.

## Technical setup

- **Drizzle ORM** on **Postgres**, driver **`postgres`** (postgres.js): the same connection string works both with **Neon** (used only for local development, by decision — no Docker/native Postgres installed in this environment) and with the self-hosted Postgres that will be used in production when the infra plan resumes. No divergent code between the two environments.
- Configuration via the `DATABASE_URL` environment variable (`.env.local` file, not committed).
- Migrations with `drizzle-kit`; the exact command (`push` in development vs `generate`+`migrate` for a history of migration files) is decided in the implementation plan, not here.

## Entities

### `users` (stub — this is not authentication)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `currency` | text, not null, default `'EUR'` | ISO 4217 currency code, a per-user setting chosen during onboarding (see the `CLAUDE.md` note); **a single currency per user**, not per account/transaction |
| `created_at` | timestamp, not null, default now | |

Conscious placeholder: when better-auth arrives (future plan, currently paused together with the infra), this table will almost certainly be reshaped to fit the user schema required by the library. It only serves to have a stable FK for the other tables right now, avoiding an invasive migration on accounts/categories/transactions when authentication actually arrives.

### `categories`

Seeded per user when the user is created (not a shared global list), to leave the door open, without friction, to future per-user customisation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `users.id`, not null | |
| `name` | text, not null | |
| `type` | enum(`fissa`, `variabile`), not null | used by the "Fisse vs variabili" (Fixed vs variable) chart in Spese |
| `created_at` | timestamp, not null, default now | |

Seed of the 8 categories (criterion: recurrence/predictability of the amount month over month):
- **fisse** (fixed): Affitto, Bollette & casa, Abbonamenti
- **variabili** (variable): Spesa alimentare, Ristoranti, Altro, Svago, Trasporti

### `accounts` (Conti)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `users.id`, not null | |
| `name` | text, not null | |
| `institution` | text, nullable | bank/institution — nullable for manual accounts without a bank (e.g. "Contanti") |
| `type` | text, not null | account type (e.g. "corrente", "contanti") — free text, no fixed taxonomy emerged from the mockup |
| `balance` | numeric(12,2), not null, default 0 | |
| `source` | enum(`manuale`, `auto`), not null, default `manuale` | "auto" accounts will be read-only except for "scollega" (disconnect) at the application level — constraint enforced in the implementation plan, not in the schema |
| `created_at` / `updated_at` | timestamp, not null | |

### `transactions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `users.id`, not null | |
| `account_id` | uuid, FK → `accounts.id`, not null | |
| `category_id` | uuid, FK → `categories.id`, not null | |
| `description` | text, not null | |
| `amount` | numeric(12,2), not null | **signed**: negative = outflow, positive = inflow (generalised from now on to avoid a migration when Cash flow arrives) |
| `excluded_amount` | numeric(12,2), not null, default 0 | share excluded from the count ("Dividi" mechanism), same sign as `amount`; constraint `|excluded_amount| ≤ |amount|` |
| `date` | date, not null | |
| `source` | enum(`manuale`, `auto`), not null, default `manuale` | |
| `created_at` / `updated_at` | timestamp, not null | |

Index on `(user_id, date)` for period queries (Spese KPIs: week/month/3 months/year).

### `budgets`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `users.id`, not null | |
| `category_id` | uuid, FK → `categories.id`, not null | |
| `monthly_amount` | numeric(12,2), not null | |
| `created_at` / `updated_at` | timestamp, not null | |

Uniqueness constraint on `(user_id, category_id)`: a single *current* budget per category, no per-month history (no "January budget" different from a "February budget" saved over time). "Budget rimanente" (remaining budget) in Spese = sum of the `monthly_amount`s minus what was spent in the current period.

## Out of scope and future (tracked explicitly, see also `CLAUDE.md`)

**What we are doing now**: this spec + the implementation plan that will follow only produce the data schema (Drizzle + migration + seed), no UI, no API, no real authentication.

**What we consciously skip in this spec, and why**:
- **Per-month budget history**: no explicit request in `functional-spec.md`; a dedicated entity/column will be added if and when there is a real need to compare budgets of different months.
- **User-customisable categories** (renaming/adding): no evidence it is needed today; the per-user seed leaves the door open anyway.
- **Multi-currency per account/transaction**: the currency is a single per-user setting (onboarding), not per row; if a foreign-currency account is ever needed it will be an explicit extension.
- **Real authentication** (the `users` table is a stub): deferred to the infra/auth plan, currently paused. [completed in 2026-07-04 auth plan]
- **DB-side enforcement of the `|excluded_amount| ≤ |amount|` constraint**: for now it stays a documented/application-level constraint in the schema; if bugs with inconsistent data emerge, a Postgres CHECK constraint will be evaluated in the implementation plan.

**What is planned for the future, and when to come back to it**:
- **Monthly budget → real Spese screen**: the natural next spec after this one, to build the UI that consumes `transactions`/`categories`/`budgets`.
- **Investments, Debts, Pension, Real estate**: separate data model specs, when those screens are tackled.
- **Pianifica scenarios and automatically detected subscriptions**: they depend on the entities above and will come later.
- **Infra plan (k3s, CI/CD)**: paused (see `docs/superpowers/plans/2026-07-03-infra-foundation.md`), to be resumed when there is enough real application to deserve a production deploy.
- **Authentication (better-auth)**: when it resumes, it will almost certainly require reshaping `users` — a known impact, accepted from now on.
