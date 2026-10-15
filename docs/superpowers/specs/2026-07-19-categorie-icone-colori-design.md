# Categories: icons/colours + full management — Design

Date: 2026-07-19
Status: approved, awaiting implementation plan.

## Context

Decided on 2026-07-19 (after the Spese screen was completed) to tackle two follow-ups deferred during the Spese plan: (1) a separate Budget section (today the per-category budget lives inside Spese and "takes up too much space"), (2) icons/colours for the spending categories. This document covers the second point, chosen as the first sub-project because it is smaller and preparatory (Budget will want to show the categories with their icons).

Today categories are managed only by the automatic seed (`DEFAULT_CATEGORIES` in `lib/db/schema/categories.ts`, seeded by `databaseHooks.user.create.after` when the user is created): no UI for creating/editing/deleting, read-only (`GET /api/categories`). This design introduces full management (CRUD) plus customisable icon/colour, following the pattern already validated for accounts (`lib/validation/accounts.ts`, `account-avatar.tsx`, `account-icon-color-picker.tsx`).

## Decisions made during brainstorming

- Icon/colour **customisable** by the user (not only fixed defaults) → requires a picker, as for accounts.
- Together with icon/colour, **full category management** (create/rename/delete), not only icon/colour on existing categories.
- The management UI lives in a **dedicated page, independent of Budget** (`/categorie`), deliverable in this sub-project without waiting for the design of the Budget section.
- **No new sidebar entry**: the page is reachable from a "Gestisci categorie" ("Manage categories") link in the Spese header (and in the future Budget).
- Deleting a category with linked transactions/budgets: **reassign to "Da categorizzare"** ("To categorise") (does not block), then delete the associated budget and the category.
- Icon palette **dedicated to spending** (not the same set as accounts), but **the same 8 colours** as accounts for theme consistency.

## Data model

Migration on `categories` (`lib/db/schema/categories.ts`). Consistent with `lib/db/schema/accounts.ts` (where `color`/`icon` are already `text` with a default, validated only at the Zod level, not Postgres enums): no new `pgEnum`, same pattern.

```ts
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: categoryTypeEnum("type").notNull(),
    color: text("color").notNull().default("slate"),
    icon: text("icon").notNull().default("package"),
    isFallback: boolean("is_fallback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("categories_user_name_unique").on(table.userId, table.name)]
);
```

`isFallback`: true only for the "Da categorizzare" category seeded by the seed. Not exposed/editable via the public API (set only by the seed), used as a guard on deletion. Do not rely on the string name to recognise it (the name can be renamed), hence the need for the flag.

Backfill for existing users (categories created before this feature, without color/icon/isFallback): mapping by exact name against `DEFAULT_CATEGORIES`, then default `package`/`slate`/`isFallback=false` for everything else (custom categories a user might already have — a case that does not apply today since manual creation does not exist yet, but the migration must still be total/not fail on unexpected rows):

| Name (seed) | icon | color | isFallback |
|---|---|---|---|
| Affitto | home | slate | false |
| Bollette & casa | zap | yellow | false |
| Abbonamenti | tv | purple | false |
| Spesa alimentare | shopping-cart | green | false |
| Ristoranti | utensils | orange | false |
| Altro | package | slate | false |
| Svago | film | teal | false |
| Trasporti | car | blue | false |
| Da categorizzare | help-circle | red | true |

`DEFAULT_CATEGORIES` in `categories.ts` must be extended with the corresponding literal `icon`/`color`, so the seed for new users applies these values directly (no migration needed for users created after the deploy).

## Palette

**Colours** (`CATEGORY_COLORS`, in a new `lib/validation/categories.ts`): the same 8 values as `ACCOUNT_COLORS` — `slate, blue, green, yellow, purple, orange, red, teal`.

**Icons** (`CATEGORY_ICONS`, 28, all verified to exist in `lucide-react`):
`utensils, shopping-cart, home, zap, droplet, wifi, tv, smartphone, car, bus, plane, fuel, film, gamepad-2, music, heart, stethoscope, dumbbell, graduation-cap, baby, paw-print, shirt, scissors, gift, briefcase, wrench, package, help-circle`.

**Shared refactor**: the colour→Tailwind classes map (`bg`/`fg` for each of the `ACCOUNT_COLORS`/`CATEGORY_COLORS` values, which are identical) today lives only inside `account-avatar.tsx` (`COLOR_MAP`). It must be extracted into `components/domain/shared/color-swatches.ts` (`SWATCH_COLORS` + `COLOR_SWATCH_MAP`), reused by both `account-avatar.tsx` and the new `category-avatar.tsx`, instead of duplicating the same bg/fg map twice. `account-avatar.tsx` is updated to import from there (no visible change in behaviour).

## API

Existing route `app/api/categories/route.ts` (only `GET` today) and new `app/api/categories/[id]/route.ts`:

- `GET /api/categories` — contract unchanged, the new fields (`color`, `icon`, `isFallback`) appear automatically in the response.
- `POST /api/categories` — creates a category. Body: `{ name, type, icon?, color? }` (icon/color optional, default `package`/`slate` if omitted). Zod validation: `name` not empty, unique per user (409 if duplicate), `type` in `["fissa","variabile"]`, `icon`/`color` within the enums.
- `PATCH /api/categories/[id]` — rename / change `type` / `icon` / `color`. Ownership check (the category must belong to the authenticated user, otherwise 404 — the same IDOR-safe pattern already used for transactions/accounts). `isFallback` not accepted as input (ignored, or 400 if present).
- `DELETE /api/categories/[id]` — ownership check. If `isFallback === true` → 409 with a message ("la categoria di fallback non può essere eliminata" — "the fallback category cannot be deleted"). Otherwise, in a DB transaction: (1) all transactions with this `categoryId` are reassigned to the user's `isFallback` category, (2) the linked budget (if any) is deleted, (3) the category is deleted.

## Components

New folder `components/domain/categories/` with barrel `index.ts`:

- `category-avatar.tsx` — Lucide icon on a coloured circle, mirror of `account-avatar.tsx` but with an `ICON_MAP` over the 28 spending icons and colours from the shared `COLOR_SWATCH_MAP`.
- `category-icon-color-picker.tsx` — colour/icon selection popover, mirror of `account-icon-color-picker.tsx` (same structure, different dataset).
- `category-row.tsx` — row of the management page: clickable `CategoryAvatar` (opens the picker), name editable inline (commit on blur, same validation pattern as `category-breakdown.tsx`), fixed/variable type select, delete button with a confirmation `AlertDialog` (disabled, with an explanatory tooltip, if `isFallback`).
- `add-category-form.tsx` — "+ Nuova categoria" ("New category") form (name + type; icon/colour stay at the defaults until opened from the picker after creation).

Other files touched:

- `lib/validation/categories.ts` (new) — `CATEGORY_ICONS`, `CATEGORY_COLORS`, types `CategoryIcon`/`CategoryColor`, Zod schemas for create/update.
- `lib/queries/categories.ts` — added `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useDeleteCategoryMutation` (same pattern as `lib/queries/budgets.ts`).
- `app/(app)/categorie/page.tsx` (new) — orchestration: list of `CategoryRow` + `AddCategoryForm`, no business logic in the page.
- `app/(app)/spese/page.tsx` — added a "Gestisci categorie" → `/categorie` link in the header.
- `components/domain/expenses/category-breakdown.tsx` — each row shows `CategoryAvatar` (16px) next to the category name.
- `components/domain/expenses/transaction-row.tsx` — the `SelectValue` of the category select shows `CategoryAvatar` + name instead of the name alone.
- `components/domain/accounts/account-avatar.tsx` — imports `COLOR_SWATCH_MAP` from `components/domain/shared/color-swatches.ts` instead of defining `COLOR_MAP` locally.

## Edge cases

- Renaming to a name already used by the same user → 409, message "Categoria già esistente" ("Category already exists").
- Changing the `type` of a category with historical transactions → no block: the calculation engine (`lib/calc/expenses.ts`) reads `category.type` at calculation time, no data migration required.
- `isFallback` is read-only via the API; only the seed sets it to `true` for "Da categorizzare".
- Deletion with a linked budget: the budget is deleted in the same DB transaction as the transaction reassignment, never left orphaned.
- Renaming the fallback category remains allowed (only deletion is blocked) — useful in view of future i18n.

## Testing

- **Unit**: Zod validation (empty `name`, invalid `type`, `icon`/`color` outside the enums).
- **Integration**: `POST`/`PATCH`/`DELETE` with cross-user ownership (pattern already used for transactions/accounts — see the IDOR note in the GoCardless/Spese changelog); `DELETE` with linked transactions checks the reassignment to `isFallback`; `DELETE` on the `isFallback` category → 409.
- **Component**: changing icon/colour from the picker is reflected in the avatar; rename on blur in `category-row.tsx`; creation from `add-category-form.tsx`.

## Out of scope (explicitly deferred)

- Separate Budget section (second sub-project, not brainstormed yet).
- Category colours used in the Spese charts (today the "Fisse vs variabili" donut is not per category; a possible per-category chart belongs to the design of the Budget page).
- i18n of category names (out of scope until the i18n infrastructure exists, see CLAUDE.md).
