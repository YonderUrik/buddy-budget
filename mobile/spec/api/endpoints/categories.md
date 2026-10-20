# Categories

Feature area(s): Categories page (grouped by Dovute / Volute / Te futuro / Saltuarie / Entrate / Trasferimenti), category picker in transactions & Categorize, Budget
Source: `app/api/categories/route.ts`, `app/api/categories/[id]/route.ts`, `app/api/categories/distribute-colors/route.ts`, `app/api/categories/usage/route.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | `/api/categories` | List user categories (raw stored names) | session | — |
| POST | `/api/categories` | Create a category | session | no demo-guard |
| PATCH | `/api/categories/{id}` | Update name/type/color/icon/description | session | may rewrite transactions' `excludedAmount` and delete budget |
| DELETE | `/api/categories/{id}` | Delete category; its transactions go back to the fallback | session | cascades |
| POST | `/api/categories/distribute-colors` | Reassign unique colors to all non-fallback categories | session | — |
| GET | `/api/categories/usage` | Transaction count per category over last 365 days | session | — |

## Shared type: `Category`

Raw row of table `categories`.

```ts
type CategoryType = "dovuta" | "voluta" | "futuro" | "saltuaria" | "entrata" | "trasferimento";

interface Category {
  id: string;               // uuid
  userId: string;
  name: string;             // AS STORED (not localized, see Mobile notes); unique per user
  defaultKey: string | null;// stable key of an app-provided default category (e.g. "tasse", "rimborsi"); null for custom ones
  type: CategoryType;
  color: SwatchColor;       // default "slate"; 48-value palette, see accounts.md
  icon: CategoryIcon;       // default "package"
  description: string | null; // <= 120 chars
  isFallback: boolean;      // exactly one per user: "Da categorizzare"
  createdAt: string;        // ISO-8601
}
```

`CategoryType` semantics (`lib/categories/groups.ts`):

| value | label (it) | meaning / direction |
|---|---|---|
| `dovuta` | Dovute | expense group (needs) — negative amounts |
| `voluta` | Volute | expense group (wants) — negative amounts (default type proposed for new categories) |
| `futuro` | Te futuro | expense group (savings/investments as expense) — negative amounts |
| `saltuaria` | Saltuarie | expense group (irregular) — negative amounts |
| `entrata` | Entrata | income — positive amounts |
| `trasferimento` | Trasferimenti tra conti | transfer between own accounts — either sign; always 100% excluded from stats and budgets |

Fallback category: `isFallback: true`, has its own `type` (any) but is treated as direction-less (accepts both signs) and goes into the statistical bucket `daCategorizzare`. It can't be renamed, deleted, or turned into `trasferimento`.

`CategoryIcon` (verbatim): `utensils, shopping-cart, home, zap, droplet, wifi, tv, smartphone, car, bus, plane, fuel, film, gamepad-2, music, heart, stethoscope, dumbbell, graduation-cap, baby, paw-print, shield, shirt, scissors, gift, briefcase, wrench, package, help-circle, shopping-bag, smile, alert-triangle, wallet, credit-card, piggy-bank, banknote, landmark, receipt, trending-up, coins, flame, sofa, hammer, paintbrush, laptop, headphones, camera, printer, train-front, ship, map-pin, luggage, coffee, pizza, wine, cake, pill, activity, glasses, book-open, palette, bike, calculator, watch` (lucide names).

## GET /api/categories
Route name: `categories.list` · Auth: session required

**Response** `200` — `Category[]` ordered by `createdAt` ascending. No pagination.

**Localized on the server** (gaps.md **G11**, branch `feat/mobile-api-foundations`): default categories (known
`defaultKey` whose stored name is a default label in any language, and the fallback via `isFallback`) come back with
`name` and default `description` in the **user's language** (`resolveProfile(user)`, `localizeCategory`). Custom names
and descriptions are returned as stored. Presentation only: ids, stored names and assignments are unchanged, and the
web's own client-side `localizeCategory` is idempotent on these values. **Display `name` as is.**

Example for a user with `language: "en"` whose rows are stored in Italian ("Spesa", "Da categorizzare"):

```json
[{"id": "6ef3b881-f09c-4541-b7df-20e24e3924d3", "userId": "DcXxMKA4Emp5d4QaWm4nLNymBQbrSWZ3", "name": "Groceries", "defaultKey": "spesa", "type": "dovuta", "color": "green", "icon": "shopping-cart", "description": "Supermarkets, groceries, household supplies", "isFallback": false, "createdAt": "2026-10-18T14:55:30.367Z"}, {"id": "a6a3e9b2-a303-4348-8918-f538eb90fc96", "userId": "DcXxMKA4Emp5d4QaWm4nLNymBQbrSWZ3", "name": "To categorise", "defaultKey": "da-categorizzare", "type": "voluta", "color": "red", "icon": "help-circle", "description": null, "isFallback": true, "createdAt": "2026-10-18T14:55:30.367Z"}]
```

Fixtures: [categories.json](../fixtures/categories.json) (Italian demo user), [categories-en.json](../fixtures/categories-en.json)
(English user, rows stored in Italian).

**Errors**: 401 empty (no session).

## POST /api/categories
Route name: `categories.create` · Auth: session cookie required · No demo guard.

**Request body** (`application/json`, `createCategorySchema`)

```ts
interface CreateCategoryBody {
  name: string;          // trimmed, min 1; must be unique for the user (exact, case-sensitive match on stored name)
  type: CategoryType;    // required
  color?: SwatchColor;   // omitted -> "slate"
  icon?: CategoryIcon;   // omitted -> "package"
  description?: string;  // trimmed, max 120; empty string is treated as absent
}
```

**Response** `201` — created `Category` (`isFallback:false`, `defaultKey:null`).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ "error": "<first zod issue message>", "code": "validation_failed", "field": "<path>" }` | validation |
| 409 | `{ "error": "Categoria già esistente", "code": "category_exists" }` | name already used by the user (also guaranteed by DB unique `categories_user_name_unique`) |
| 500 | `{ "error": "Errore interno", "code": "internal_error" }` | invalid JSON |

## PATCH /api/categories/{id}
Route name: `categories.update` · Auth: session cookie required · Guards: ownership

**Request body** (`updateCategorySchema`, at least one key):

```ts
interface UpdateCategoryBody {
  name?: string;              // trimmed, min 1
  type?: CategoryType;
  color?: SwatchColor;
  icon?: CategoryIcon;
  description?: string | null; // trimmed, max 120; "" or null => clears (stored null)
}
```

**Behaviour, in order**
1. 404 if not owned (before body parsing).
2. Zod validation -> 400 (`"Nessun campo da aggiornare"` for `{}`).
3. **Localized-label normalization**: the server computes the *displayed* (localized) name/description of the category for the user's locale profile (`localizeCategory(category, resolveProfile(user))`). If the body's `name` equals the displayed name, `name` is dropped; same for `description`. This lets a client send back the localized label it shows without it counting as a rename. If nothing remains -> `200` with the unchanged category.
4. Fallback rename -> 409 `"Il nome della categoria di fallback non può essere modificato"`.
5. Duplicate name -> 409 `"Categoria già esistente"`.
6. Fallback to `trasferimento` -> 400 `"La categoria da categorizzare non può diventare un trasferimento"`.
7. DB transaction:
   - update the row; if the name actually changes, `defaultKey` is set to `null` (it becomes a custom category, no longer localized).
   - if `type` changes **to** `trasferimento`: every transaction of this category (of the user) gets `excludedAmount = amount` (fully excluded), and the category's budget is deleted.
   - if `type` changes **from** `trasferimento` to anything else: every transaction gets `excludedAmount = "0"`.

**Response** `200` — the updated `Category` (raw, not localized).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ "error": "Categoria non trovata", "code": "category_not_found" }` | not found / not owned |
| 400 | `{ "error": "<zod msg>", "code": "validation_failed", "field": "<path>" }` | validation |
| 409 | `{ "error": "Il nome della categoria di fallback non può essere modificato", "code": "fallback_category_locked" }` | renaming fallback |
| 409 | `{ "error": "Categoria già esistente", "code": "category_exists" }` | duplicate name |
| 400 | `{ "error": "La categoria da categorizzare non può diventare un trasferimento", "code": "fallback_category_locked" }` | fallback -> trasferimento |
| 500 | `{ "error": "Errore interno", "code": "internal_error" }` | invalid JSON |

**Side effects**: see step 7 (mass update of `transactions.excludedAmount`, `budgets` delete).

## DELETE /api/categories/{id}
Route name: `categories.delete` · Auth: session cookie required

**Response** `204` — empty.

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ "error": "Categoria non trovata", "code": "category_not_found" }` | not found / not owned |
| 409 | `{ "error": "La categoria di fallback non può essere eliminata", "code": "fallback_category_locked" }` | category is the fallback |
| 500 | `{ "error": "Categoria di fallback non trovata", "code": "internal_error" }` | user has no fallback category (data inconsistency) |

**Side effects** (single DB transaction)
- All transactions of the category are moved to the fallback category, with `categorySource`, `categoryConfidence`, `categorizedAt` reset to `null`; if the deleted category was `trasferimento`, `excludedAmount` is reset to `"0"` (otherwise `excludedAmount` is kept as is).
- The category's budget is deleted.
- The category is deleted; its `categorization_rules` cascade (FK `onDelete: cascade`).

## POST /api/categories/distribute-colors
Route name: `categories.distribute_colors` · Auth: session cookie required

No body. Reassigns `color` for every non-fallback category of the user, ordered by `createdAt` asc, iterating through the 48-color pool `SWATCH_COLORS` (16 base, then 16 `-light`, then 16 `-dark`); beyond 48 it cycles, never giving the same color to two adjacent categories. All updates in one transaction.

**Response** `200` — `Category[]` (only the non-fallback categories, in `createdAt` order, with new colors).

**Errors**: 401 empty.

## GET /api/categories/usage
Route name: `categories.usage` · Auth: session cookie required

Counts the user's transactions per `categoryId` with `date >= today(UTC) - 365 days` (`CATEGORY_USAGE_WINDOW_DAYS = 365`). Used by the category picker to put most-used categories first.

**Response** `200` — `Record<categoryId, number>`; categories with no transactions in the window are absent. Counts are JSON numbers.

```json
{ "1c2d…": 142, "0b9a…": 7 }
```

**Errors**: 401 empty.

**Mobile notes**: changes slowly; the web caches it for 5 minutes (`staleTime`). Do the same.

## Mobile notes (resource-wide)
- **Localization is client-side**: `GET /api/categories` returns stored names. The web applies `localizeCategory(row, profile)` (`lib/localization/categories.ts`) in the query `select`: for the fallback, or for a category whose `defaultKey` matches a default AND whose stored name is one of that default's known translations, the displayed name/description is the translation for the user's language/country. Native clients must replicate this (or the server must expose localized names — see gaps).
- When editing a localized default category, sending back the displayed localized name is safe (server ignores it as "no rename").
- Changing a category's type to/from `trasferimento` changes historical stats (excluded amounts); warn the user.
- The rule "expense groups = negative, entrata = positive, trasferimento/fallback = either" governs which categories can be assigned to a transaction (see `transactions.md`).

## Cross-cutting observations
- 500 `{ "error": "Categoria di fallback non trovata" }` is an explicit, non-generic 500 body.
