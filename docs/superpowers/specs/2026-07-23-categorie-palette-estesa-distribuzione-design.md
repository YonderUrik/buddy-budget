# Design: extended colour/icon palette for categories + automatic colour distribution

Date: 2026-07-23

## Context

Today categories have a palette of 8 colours (shared with Conti — Accounts — `lib/validation/shared-colors.ts`) and 28 icons (`lib/validation/categories.ts`). With many custom categories, duplicate colours across different categories become likely and the available palette/icons are perceived as limited. User request: more colours, more icons, and a button that automatically distributes the colours among the categories, avoiding duplicates.

No DB migration needed: `categories.color` and `categories.icon` (and the equivalents on `accounts`) are `text` columns, not Postgres enums — the expansion is only at the application Zod/TypeScript enum level.

## 1. Extended colour palette (8 → 48)

Decision: extend the **shared** palette `shared-colors.ts` (it also affects Conti, not only categories) — visual consistency between the two entities is maintained.

### 16 base colours

8 existing: `slate`, `blue`, `green`, `yellow`, `purple`, `orange`, `red`, `teal`.
8 new: `pink`, `indigo`, `cyan`, `lime`, `amber`, `rose`, `violet`, `emerald`.

All 16 are standard Tailwind colour families — the same class scheme already in use today:
- Avatar (`COLOR_SWATCH_MAP`): `bg-{c}-100 dark:bg-{c}-900/40` / `text-{c}-600 dark:text-{c}-400`
- Picker dot (`COLOR_DOT`): `bg-{c}-500`
- Multi-level pie (`SWATCH_CHART_COLOR`): CSS var `--swatch-{c}` (literal hex, shade 500), added in `app/globals.css` in both `:root` and `.dark` (today the two blocks have identical values for the existing colours — same pattern for the new ones).

### 32 variants (for automatic distribution)

Each base colour has 2 variants derived from the same Tailwind family, using different shade steps instead of arbitrary hex values:
- `{base}-light`: shade 300 (dot), 50/800 (avatar bg light/dark), 500/300 (avatar fg light/dark)
- `{base}-dark`: shade 700 (dot), 200/950 (avatar bg light/dark), 700/300 (avatar fg light/dark)

Example for `blue`: the base uses blue-500 (dot) / blue-100·blue-900 (bg) / blue-600·blue-400 (fg); `blue-light` uses blue-300 (dot) / blue-50·blue-800 (bg) / blue-500·blue-300 (fg); `blue-dark` uses blue-700 (dot) / blue-200·blue-950 (bg) / blue-700·blue-300 (fg). The exact hex values for `--swatch-{base}-light` / `--swatch-{base}-dark` are to be taken from Tailwind's default palette (shade 300/700 of the corresponding family) during implementation.

Total pool: 16 + 32 = 48 enum values in `SwatchColor`.

### Manual picker

`CategoryIconColorPicker` (and the equivalent for Conti) shows **only the 16 base colours** — compact grid, unchanged in shape. The 32 variants cannot be selected manually: they exist only as output of the automatic distribution algorithm (section 3).

## 2. Extended icons (28 → 60)

+32 new icons (lucide-react), covering areas not yet represented (finance, home, technology, travel, food, health, leisure):

`wallet`, `credit-card`, `piggy-bank`, `banknote`, `landmark`, `receipt`, `trending-up`, `coins`, `flame`, `sofa`, `hammer`, `paintbrush`, `laptop`, `headphones`, `camera`, `printer`, `train-front`, `ship`, `map-pin`, `luggage`, `coffee`, `pizza`, `wine`, `cake`, `pill`, `activity`, `glasses`, `book-open`, `palette`, `bike`, `calculator`, `watch`.

Added to `CATEGORY_ICONS` (`lib/validation/categories.ts`) and to `ICON_MAP` (`components/domain/categories/category-avatar.tsx`), the same kebab-case → PascalCase Lucide component pattern already in use. The icon picker (`CategoryIconColorPicker`) stays a scrollable grid: no layout change required, just more rows.

## 3. "Distribuisci colori" button

### UI

Button in the header of the `/categorie` page (`app/(app)/categorie/page.tsx`), next to the title, labelled "Distribuisci colori" ("Distribute colours"). On click it opens a confirmation `AlertDialog` (`components/ui/alert-dialog.tsx`, already present): explicit text saying that the action overwrites the colours currently assigned to all non-fallback categories. Confirm → mutation call → invalidation of the categories query (optimistic update not needed, the list is short).

### Endpoint

New route `POST /api/categories/distribute-colors`, dedicated and atomic (does not reuse the single PATCH):
1. Reads all categories of the session user with `isFallback = false`, sorted by `createdAt asc` (the same order as the list in the UI).
2. Computes the new colour assignment (algorithm below).
3. Applies all updates in a single Drizzle transaction (`db.transaction`) — if something fails, no category is touched.
4. Implicit ownership: the query is filtered by the session `userId`, the same pattern as the other category endpoints (no id provided by the client, hence no IDOR surface).

The fallback category ("Da categorizzare" — "To categorise") is never included: it always stays red, a fixed visual signal independent of the algorithm.

### Assignment algorithm

Given the ordered list of N non-fallback categories:
1. If N ≤ 16: assign the 16 base colours in order, one per category, no repetition possible.
2. If 16 < N ≤ 48: use the full pool of 48 (16 base + 32 variants) in an order that maximises the distance between repetitions of the same colour family (interleaving: first a round over all 16 base colours, then a round over the "light" variants, then over the "dark" ones — do not group the 3 shades of the same family one after the other).
3. If N > 48: the pool repeats cyclically, but no two adjacent categories in the list ever get the same colour (guaranteed by the simple fact that the cycle has length 48 ≫ 1; no further logic needed unless N exceeds 48 by a little and the last element of the cycle borders the first of the next round — in that case the algorithm discards the pool's last colour if it coincides with the first and uses the next one).

Implemented as a testable pure function (`lib/calc/distribute-colors.ts` or similar), separate from the route handler, to allow unit tests without a DB.

## Data flow

```
click "Distribuisci colori"
  → AlertDialog confirmation
  → mutation POST /api/categories/distribute-colors
  → route: reads user categories (no fallback) → computes assignment (pure function) → update transaction
  → 200 response with updated categories
  → categories query invalidation → CategoryRow/CategoryAvatar re-render with the new colours
```

## Error handling

- No non-fallback category present: the endpoint responds 200 no-op (no error, nothing to distribute).
- Query/transaction failure: 500, no category modified (transactional atomicity), error toast in the UI, the dialog closes with no visible changes.
- User without a session: 401, the same existing middleware pattern.

## Testing

- Unit tests of the pure colour assignment function: N=0, N=1, N=16 (no repetition), N=17 (first repetition, check non-adjacency), N=48, N=49 (check wrap-around without identical colour between last and first).
- Unit test that the fallback category never appears in the input of the assignment function.
- Manual test in the browser (by the user, as for the previous features — no Postgres/Redis in the agent sandbox): create >16 categories, click "Distribuisci colori", check there are no identical adjacent colours; check that "Da categorizzare" stays red; check that the manual picker shows only the 16 base colours.

## Out of scope

- Arbitrary hex colours/unlimited dynamic generation (rejected in brainstorming in favour of the fixed 48-value palette — a wider architectural change, not needed for the realistic category volumes of this app).
- Automatic redistribution of icons (explicitly requested only for colours).
- Manual selection of the 32 light/dark variants in the picker (reserved to the algorithm).
