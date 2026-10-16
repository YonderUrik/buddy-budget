# Design: Spese screen

**Date**: 2026-07-15
**Status**: approved in brainstorming, awaiting implementation plan

## Context

First domain screen implemented after the GoCardless integration was completed (Tasks 1-16 complete, see `CLAUDE.md`). Transactions synced from GoCardless arrive with the fallback category "Da categorizzare" ("To categorise") — Spese (Expenses) is where they must be managed and recategorised. The scope is defined in detail in `docs/functional-spec.md` (section "3. Spese"), which documents both what the mockup does and the decisions made for the real product for each gap in the mockup.

Scope decision (confirmed with the user): implement everything in a single round — KPIs, charts, categories with budgets, full transaction list (editing/split/delete), add form, budget setting — not in separate phases.

## Existing state reused

Checked in the code before designing, so as not to duplicate:

- **`transactions`** (`lib/db/schema/transactions.ts`): already exists. Relevant columns: `amount`, `date`, `description`, `categoryId` (FK, always set), `accountId` (FK), `source` (`manuale`/`auto`), `externalId` (unique for sync idempotency), **`excludedAmount`** (already the "Dividi" — split — field: persisted, not local UI state as in the mockup). Existing validation `isValidExcludedAmount()`.
- **`categories`** (`lib/db/schema/categories.ts`): already exists, per user. 8 fixed categories + the "Da categorizzare" fallback already seeded in `databaseHooks.user.create.after` (`lib/auth/index.ts`) and `lib/db/seed.ts`. `type`: `fissa`/`variabile` (fixed/variable; needed for the "Fisse vs variabili" donut).
- **`budgets`** (`lib/db/schema/budgets.ts`): already exists, never consumed by UI/API. `monthlyAmount` per `(userId, categoryId)`, monthly budget only.
- **Does not exist**: no period calculation engine (week/month/3 months/year) anywhere in the repo. It must be designed from scratch.
- **Reference pattern**: the Conti screen (`app/(app)/conti/`, `components/domain/accounts/`, `lib/queries/accounts.ts`, `app/api/accounts/`) — same stack of Route Handlers + TanStack Query + Zod + ownership check, same `*-kpi.tsx`/`*-kpi.utils.ts` pattern to separate UI and calculation.

## Architecture

### Period calculation engine — `lib/calc/expenses.ts`

Pure module, no side effects, testable in isolation:

- `getPeriodRange(period, referenceDate)` → `{from, to}` for Week/Month/3 months/Year
- `getPreviousPeriodRange(period, referenceDate)` → the window immediately before, same length (needed for "Media giornaliera" — daily average — vs previous period)
- `computeKpis(transactions, budgets, period)` → Spent in the period, Remaining budget, Daily average + comparison with the previous period
- `computeCategoryBreakdown(transactions, categories, period)` → amount for each of the 8 categories
- `computeFixedVsVariable(transactions, categories, period)` → data for the donut
- `compute6MonthTrend(transactions)` → data for the last-6-months bar chart (independent of the selected period)

All functions operate on an "effective" `amount` = `amount - excludedAmount` per transaction: this ensures that "Dividi" is automatically consistent everywhere (KPIs, categories, charts), fixing the misalignment in the mockup (in the mockup the KPIs and the "Dividi" slider were two disconnected systems).

### Why client-side calculation, not SQL aggregation

`docs/functional-spec.md` explicitly says that server-side pagination/filters are only needed "when the real volume exceeds the handful of demo rows" — not the case now. A single `GET /api/transactions?from&to` returns a 13-month window (covering the "Anno" (Year) period + the comparison with the previous period + the 6-month trend), and everything else is pure, reusable JS calculation. A future migration to server-side SQL aggregation remains an isolated optimisation: it would change only the endpoint, not the signatures of the calculation functions.

### Monthly budget and non-monthly periods

The budget in the DB is monthly only (`monthlyAmount`). For periods other than "Mese" (Month), the period budget is **proportional**: e.g. Week ≈ `monthlyAmount / 30 * 7`, 3 months = `monthlyAmount * 3`, Year = `monthlyAmount * 12`. Consistent with the example in the functional spec ("Settimana: € 640 su € 740").

### Amount sign convention and income filter

`transactions` is shared with the future general account sync: GoCardless imports **all** bank transactions, not just outflows (e.g. salaries, incoming transfers too), with the standard sign convention (negative = outflow, positive = inflow). The Spese screen must show/compute **only outflows**: every query and every function of the calculation engine filters on `amount < 0`. Income (positive amount) stays in the same table but is invisible in this screen — it will serve the future Cash flow screen. The manual entry form in Spese offers only the 8 spending categories: the user types a positive amount ("Importo €"), which is negated before being saved (consistent with the convention).

### Category handling on "Auto" transactions

The functional spec contains an apparent contradiction: it says "Auto" transactions are not editable (only "Dividi"), but also that the category must always be correctable — and GoCardless transactions arrive precisely with the "Da categorizzare" fallback category to be fixed. Resolved with the user: on Auto transactions, **only the category is editable** (besides "Dividi"); description/amount/date stay locked because they would falsify the source bank data.

### API (`app/api/transactions/`, `app/api/budgets/`)

Same pattern as `app/api/accounts/`: `auth.api.getSession({ headers })` for auth, Zod (`lib/validation/*.ts`) with `safeParse`, ownership check helper before every mutation, direct Drizzle with no repository layer.

- `GET /api/transactions?from=&to=` — list in the requested window
- `POST /api/transactions` — creates a manual transaction
- `PATCH /api/transactions/[id]` — field allowlist by `source`: `manuale` → description/amount/date/category/`excludedAmount`; `auto` → only category/`excludedAmount`. `excludedAmount` validation reuses the existing `isValidExcludedAmount()`.
- `DELETE /api/transactions/[id]` — 400 if `source = auto`
- `GET /api/budgets` — list of budgets per user
- `PUT /api/budgets/[categoryId]` — upsert of `monthlyAmount`

### Account associated with a manual expense

`transactions.accountId` is a mandatory FK, but the spec's "+ Aggiungi" (add) form does not include an account selector. Decided with the user: the form adds a **"Conto"** (account) field (select), populated only with the user's **manual** accounts (`source = "manuale"`) — "auto" accounts (connected via GoCardless) are excluded, consistent with the existing logic whereby an auto account only reflects data synced from the bank and must not be altered by local manual entries.

## Components (`components/domain/expenses/`, barrel `index.ts`)

- `expenses-period-selector.tsx` — Settimana/Mese/3 mesi/Anno (Week/Month/3 months/Year)
- `expenses-kpi-cards.tsx` + `expenses-kpi-cards.utils.ts` — Spent, Remaining budget, Daily average (UI and calculation separated, like `accounts-kpi.tsx`)
- `category-breakdown.tsx` — the 8 categories with amount and monthly budget editable inline (click → input, `PUT /api/budgets/[categoryId]`)
- `expenses-charts.tsx` — "Fisse vs variabili" donut + "Andamento ultimi 6 mesi" (last 6 months trend) bars, via the shadcn/ui `Chart` component (Recharts, already in the stack)
- `transaction-row.tsx` — conditional rendering by `source`: auto → editable category + "Dividi", no ✕; manual → everything editable + ✕
- `split-slider.tsx` — "Dividi" UI, writes `excludedAmount` via `PATCH`
- `add-transaction-form.tsx` — entry form at the bottom of the page

## Page

`app/(app)/spese/page.tsx` — client component, no business logic (consistent with the CLAUDE.md rule on routes). It orchestrates TanStack Query hooks (`lib/queries/expenses.ts`, `lib/queries/budgets.ts`) and the components above. Selected period state: local `useState` in the page (no Context needed, no other component outside this screen needs it).

## Error handling

Same pattern as Conti: loading/error/empty states handled inline in the page, mutations with error feedback consistent with what is already implemented there (the exact mechanism — toast or inline — to be checked during planning, to stay consistent). Zod validation on the API side rejects negative amounts, non-existent categories, malformed dates (400).

## Testing

TDD as per the project convention:

- **Calculation engine** (`lib/calc/expenses.ts`): pure unit tests — period boundaries, budget proportion, `excludedAmount`, comparison with the previous period. The most critical piece and the easiest to isolate.
- **API routes**: validation, ownership check, field allowlist by `source`.
- No automated E2E tests for the UI (out of scope, consistent with the rest of the project — manual verification in the browser at the end of implementation).

## Out of scope (explicit)

- Server-side SQL aggregation for the calculations (deferred until the data volume requires it)
- Advanced automatic categorisation of Auto transactions beyond the existing fallback (out of scope here, possibly a dedicated future feature)
- Pagination/search/category filter in the transaction list (for the same reason as in the functional spec: not needed with the current data volume)
