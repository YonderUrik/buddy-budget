# Spending groups for categories (Dovute / Volute / Te futuro / Saltuarie) — design

Date: 2026-09-22 · Status: approved in brainstorming, awaiting spec review

## Goal

Replace the two-level classification of expense categories (`fissa` / `variabile`, fixed / variable) with four
**spending groups**, inspired by a budgeting method based on the "destination" of money:

| Key         | UI label | Color  | Description (shown in `/categorie`) |
|-------------|--------------|--------|-----------------------------------------|
| `dovuta`    | Dovute ("Must-haves") | red    | Expenses needed to live and keep a basic lifestyle: without them you'd have practical or legal problems. |
| `voluta`    | Volute ("Wants") | yellow | They improve quality of life but you could do without them: wishes, leisure, comfort. |
| `futuro`    | Te futuro ("Future you") | green  | Savings and investments treated as a priority expense, not as what's left over. |
| `saltuaria` | Saltuarie ("Occasional") | blue   | Necessary but not monthly expenses: annual taxes, maintenance, gifts. |

Income remains a type of its own (`entrata`), unchanged.

## Decisions made in brainstorming

1. **"Te futuro" counts as a normal expense**: it goes into "Speso nel periodo" ("Spent in the period") and into all expense totals as
   today. The group is for grouping/coloring, it changes no totals.
2. **"Saltuarie" is only a grouping**: no extra logic (no annual budget spread out nor
   monthly set-aside — possibly in the future Budget section).
3. **Migration = category reset**: categories are brought back to the new default list;
   customizations are lost (accepted by the user).
4. **Short, conversational UI labels**: Dovute · Volute · Te futuro · Saltuarie.
5. **Data model: approach A** — the values of the `category_type` enum are replaced instead of adding
   a separate `group` column (income/expense direction stays derived from `type === "entrata"`).

## Out of scope (knowingly)

- Budget per group (50/30/20 style) → with the future separate **Budget** section, already on the list.
- Filter by group in the Transazioni (Transactions) screen.
- Monthly set-aside / annual budget for Saltuarie.
- Preserving custom categories during the migration (reset chosen).

## 1. Data

### Enum

`category_type`: `dovuta | voluta | futuro | saltuaria | entrata`.

### Single groups module — `lib/categories/groups.ts`

Single source of truth, imported by all layers (depends on neither React nor the DB):

- `CATEGORY_TYPES` (`as const` tuple) and `type CategoryType`.
- Ordered `EXPENSE_GROUP_KEYS` (`dovuta`, `voluta`, `futuro`, `saltuaria`) and `type ExpenseGroup`.
- `EXPENSE_GROUPS: Record<ExpenseGroup, { label; shortDescription; description; colorVar }>` —
  `colorVar` is the name of the CSS token (`--group-dovuta`, …), never a hex.
- `CATEGORY_TYPE_LABELS: Record<CategoryType, string>` (the 4 labels + "Entrata" ("Income")).
- `isExpenseGroup(type): type is ExpenseGroup`.
- `DEFAULT_NEW_CATEGORY_TYPE = "voluta"`.

All places that today repeat the literal union `"fissa" | "variabile" | "entrata"` replace it with
`CategoryType` / `ExpenseGroup`: forgetting one must become a `tsc` error, not a silent bug.
The Drizzle schema uses `pgEnum("category_type", CATEGORY_TYPES)`; Zod uses `z.enum(CATEGORY_TYPES)`.

### Fallback category "Da categorizzare"

It stays `isFallback: true`. Its `type` in the DB becomes `voluta` (a non-null value is needed, it's arbitrary):
**no statistic must classify it by `type`** — all aggregations route it via `isFallback`
into a dedicated "Da categorizzare" ("To categorize") bucket (today it silently ended up among the variable ones).

### New default categories (`DEFAULT_CATEGORIES`)

All icons already present in `CATEGORY_ICONS`. Names are app UI text and stay in Italian.

| Group | Name | Icon |
|---|---|---|
| Dovute | Affitto & Mutuo (Rent & Mortgage) | home |
| Dovute | Bollette & Utenze (Bills & Utilities) | zap |
| Dovute | Internet & Telefono (Internet & Phone) | wifi |
| Dovute | Spesa alimentare (Groceries) | shopping-cart |
| Dovute | Trasporti & Carburante (Transport & Fuel) | fuel |
| Dovute | Salute & Farmaci (Health & Medicines) | pill |
| Dovute | Assicurazioni (Insurance) | shield |
| Dovute | Rate & Finanziamenti (Instalments & Loans) | credit-card |
| Dovute | Figli & Istruzione (Children & Education) | graduation-cap |
| Dovute | Animali domestici (Pets) | paw-print |
| Volute | Ristoranti & Bar (Restaurants & Bars) | utensils |
| Volute | Abbonamenti & Streaming (Subscriptions & Streaming) | tv |
| Volute | Svago & Hobby (Leisure & Hobbies) | gamepad-2 |
| Volute | Sport & Benessere (Sport & Wellness) | dumbbell |
| Volute | Abbigliamento (Clothing) | shirt |
| Volute | Shopping & Tecnologia (Shopping & Tech) | laptop |
| Volute | Cura personale (Personal care) | scissors |
| Volute | Viaggi & Vacanze (Travel & Holidays) | plane |
| Te futuro | Fondo emergenza (Emergency fund) | wallet |
| Te futuro | Risparmio per obiettivi (Savings for goals) | piggy-bank |
| Te futuro | Investimenti (Investments) | coins |
| Te futuro | Pensione integrativa (Supplementary pension) | landmark |
| Saltuarie | Tasse & Bolli (Taxes & Stamp duties) | receipt |
| Saltuarie | Manutenzione auto (Car maintenance) | wrench |
| Saltuarie | Casa & Arredamento (Home & Furniture) | sofa |
| Saltuarie | Regali & Ricorrenze (Gifts & Occasions) | gift |
| Saltuarie | Imprevisti (Unexpected expenses) | alert-triangle |
| — (fallback) | Da categorizzare | help-circle (red, `isFallback`) |
| Entrate | Stipendio (Salary) | banknote |
| Entrate | Freelance | briefcase |
| Entrate | Dividendi e interessi (Dividends and interest) | trending-up |
| Entrate | Rimborsi (Refunds) | calculator |
| Entrate | Altre entrate (Other income) | package |

List extended at the user's request (2026-09-22) with an average person's expenses in mind, without fragmenting.

The colors of individual categories still come from the `SWATCH_COLORS` palette (assigned in the list; the user can
use "Distribuisci colori" ("Distribute colors")). The colors of the **groups** are separate tokens (see §2).

Consumers of `DEFAULT_CATEGORIES` that update automatically (they use the list, no logic change):
`lib/auth/index.ts` (new user seed), `lib/db/seed.ts`. `lib/db/backfill-category-appearance.ts` is a
historical one-shot script already run: it stays, but the reset makes it obsolete (note it in its JSDoc).

### DB migration

1. Enum migration script versioned in the repo and idempotent, `lib/db/migrate-category-groups.ts`
   (`pnpm db:migrate-category-groups`). Not a Drizzle migration: this project's DB is managed with
   `db:push` and the Drizzle journal contains only the `0000` baseline, so `db:migrate` is not reliable.
   The script reads the current values from `pg_enum` and runs only what is missing:
   `ALTER TYPE category_type RENAME VALUE 'fissa' TO 'dovuta'`,
   `ALTER TYPE category_type RENAME VALUE 'variabile' TO 'voluta'`,
   `ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'futuro' BEFORE 'entrata'`,
   `ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'saltuaria' BEFORE 'entrata'`
   (final order identical to `CATEGORY_TYPES` → `db:push` proposes no changes on this enum).
   `ADD VALUE` runs outside transactions; the data reset is a separate step.
   **Shared DB warning**: after the rename, the not-yet-merged `main` code (which writes
   `"fissa"`/`"variabile"`) is incompatible with the DB until the merge — a window to keep short.
2. One-shot script `lib/db/reset-categories.ts` (`pnpm db:reset-categories`), idempotent, one transaction
   **per user**:
   - ensures the fallback category exists (reusing the logic of `lib/categorization/fallback.ts`);
   - for each default: if a category exists with that name **or with a mapped old name**
     (`LEGACY_CATEGORY_NAMES` in `lib/db/schema/categories.ts`, rebuilt from git log over **all** the default lists
     historically seeded, not just the last one before this: pre-icons/colors defaults
     (2026-07-03→2026-07-21) "Affitto"→"Affitto & Mutuo", "Bollette & casa"→"Bollette & Utenze",
     "Ristoranti"→"Ristoranti & Bar", "Svago"→"Svago & Hobby", "Trasporti"→"Trasporti & Carburante";
     2026-07-26 defaults "Assicurazioni & Tasse"→"Assicurazioni", "Risparmi & Investimenti"→"Investimenti",
     "Trasporti & Auto"→"Trasporti & Carburante", "Salute & Cura"→"Salute & Farmaci",
     "Svago & Hobbies"→"Svago & Hobby", "Abbonamenti"→"Abbonamenti & Streaming",
     "Shopping"→"Shopping & Tecnologia", "Viaggi"→"Viaggi & Vacanze", "Regali"→"Regali & Ricorrenze";
     first version of spending groups (2026-09-22, before the extension to 33) "Manutenzione auto/casa"→"Manutenzione auto",
     "Sport & Palestra"→"Sport & Benessere". **"Altro"** ("Other", historical default until 2026-07-21) is
     deliberately left unmapped: there is no natural equivalent in the new list, so the reset deletes it
     as a custom category (its transactions end up in "Da categorizzare"))
     it updates it (name, type, icon, color) preserving its id → transactions, rules and budgets stay linked;
     otherwise it creates it;
   - every other non-fallback category not in the new list (including custom ones):
     transactions reassigned to the fallback, budgets deleted, categorization rules deleted (the FK already has
     `onDelete: cascade`, but they are deleted explicitly first for clarity/logging), category deleted;
   - per-user log: categories updated / created / deleted, transactions reassigned, plus the names involved
     (renamed "from → to", deleted).
   - `--dry-run` flag that prints the same summary (names included) without writing.
   The script must be run by the user (shared DB), after the migration.

## 2. Statistics and UI

### Color tokens

New tokens in `app/globals.css`, both in `:root` and in `.dark`, exposed in `@theme inline`:
`--group-dovuta` (red), `--group-voluta` (yellow), `--group-futuro` (green), `--group-saltuaria` (blue),
`--group-uncategorized` (neutral grey). The yellow in the light theme must be chosen with sufficient contrast as
a chart fill (not as text).

### 2a. Transazioni → "Per categoria" ("By category") card (`CategoryBreakdownDonut`)

- `computeFixedVsVariable` / `FixedVsVariable` replaced by `computeGroupTotals` / `GroupTotals`
  (`Record<ExpenseGroup, number> & { daCategorizzare: number }`), in `lib/calc/expenses.ts`.
- `CategoryAmount.type: "fissa" | "variabile"` becomes `group: ExpenseGroup | "daCategorizzare"`
  (the fallback → `"daCategorizzare"`, recognized via `isFallback`).
- Inner ring: one slice per group, in the order of `EXPENSE_GROUP_KEYS`, plus "Da categorizzare" only if > 0.
- Outer ring: `sortCategoryAmounts` sorts by group (same order, "Da categorizzare" last) and then by
  descending amount — angular alignment with the inner ring remains guaranteed.
- Legend: dot with the group color next to each row's name. Legend sort orders unchanged.
- Component JSDoc updated ("inner layer: spending group").

### 2b. Cash flow → "Dove va ogni euro" ("Where every euro goes") (`computeWhereItGoes` / `WhereItGoesBreakdown`)

Items, in this order: **Dovute, Volute, Te futuro, Saltuarie, Non classificato (Unclassified), Avanzo (Surplus)**.

- "Non classificato" = expenses in the fallback category **+** expenses in an unknown category (today only the latter).
- "Risparmio" ("Savings", income − all expenses) renamed **"Avanzo"**, key `avanzo`: with "Te futuro" as an
  expense, calling it "Risparmio" would be ambiguous. The computation doesn't change.
- The component still doesn't assume the number of items; it adds a dot with the group color for the
  four group items.

### 2c. `/categorie`

- List divided into sections: Dovute, Volute, Te futuro, Saltuarie, then Entrate (Income). Each section has a header
  with a group color dot, label and `shortDescription`. The fallback belongs to no group: it sits
  in a row of its own after Saltuarie and before Entrate, under the "Da categorizzare" header.
- The grouping logic is a pure function (`groupCategoriesByType` in `lib/categories/groups.ts` or
  next to it), the page remains only orchestration.
- `AddCategoryForm` and `CategoryRow`: type `Select` with 5 options from `CATEGORY_TYPE_LABELS`, default
  `DEFAULT_NEW_CATEGORY_TYPE`. No duplicated local `TYPE_LABELS`.

### 2d. Type change only (no visible effect)

`lib/validation/categories.ts`, `lib/categorization/match-rule.ts` (`isDirectionCompatible`, `RuleCandidate`),
`lib/categorization/suggest.ts`, `lib/categorization/fallback.ts`, `app/api/transactions/route.ts` and
`[id]/route.ts` (sign derived from `type === "entrata"`, unchanged), `app/api/categories/**`,
`app/api/categorization-rules/**`, `/categorizza`, `category-breakdown-donut.utils.ts` (`TYPE_ORDER`).

### 2e. Unchanged

6-month trend (per category), Uscite/Entrate (Expenses/Income) KPIs, Panoramica (Overview), budget per category, GoCardless sync.

## 3. Tests

- `lib/categories/groups.test.ts`: group order, complete labels for every `CategoryType`,
  `groupCategoriesByType` (separate fallback, income at the bottom, empty groups).
- `lib/calc/expenses.test.ts`: `computeGroupTotals` (4 groups + fallback in `daCategorizzare`, income excluded),
  `computeCategoryBreakdown` with `group`.
- `category-breakdown-donut.utils.test.ts`: `sortCategoryAmounts` with 4 groups + fallback last.
- `lib/calc/cashflow.test.ts`: `computeWhereItGoes` with the 6 items, fallback in "Non classificato", `avanzo`.
- `lib/db/schema/categories.test.ts`: every default has an icon in `CATEGORY_ICONS`, a valid type, unique names,
  exactly one fallback, every group has at least one category.
- Reset script: the decision (what to update/create/delete) is a pure function `planCategoryReset`
  tested with vitest, same pattern as `buildRulesFromHistory` in `backfill-categorization-rules.ts` —
  rename via `LEGACY_NAME_MAP` preserves the id; exact name wins over legacy name; custom one in
  `deletions`; fallback never touched; second plan on the already-reset state = no action. The DB wrapper
  (`resetUserCategories`) applies the plan in a transaction.
- All test fixtures that use `"fissa"`/`"variabile"` (≈20 files under `app/api/**` and `lib/**`) updated.
- Final check: clean `tsc --noEmit`, vitest suite (excluding the 3 known failures of `scheduler.test.ts`),
  `pnpm lint` with no new errors, `grep` of `"fissa"`/`"variabile"` in the code (excluding `docs/` and the
  migration) = 0 results.

## 4. Documentation

- `docs/functional-spec.md`: Spese/Transazioni (Expenses/Transactions) and Cash flow sections updated (groups, "Avanzo").
- `CLAUDE.md`: log entry + "Stato del progetto" ("Project status").

## Manual verification by the user (after implementation)

Run migration + `db:reset-categories --dry-run` then for real; check `/categorie` divided into sections,
pie with 4 group colors aligned with the outer ring, "Dove va ogni euro" with 6 items, creation of a
new category for each group, new user with the new defaults.
