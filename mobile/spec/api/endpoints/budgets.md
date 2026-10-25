# Budgets

Feature area(s): Budget / Categories (monthly budget per category), Overview budget widgets
Source: `app/api/budgets/route.ts`, `app/api/budgets/[categoryId]/route.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | `/api/budgets` | List all monthly budgets of the user | session | — |
| PUT | `/api/budgets/{categoryId}` | Create or update (upsert) the monthly budget of one category | session | no demo-guard |
| DELETE | `/api/budgets/{categoryId}` | Remove the monthly budget of one category (web #432) | session | idempotent |

A budget also disappears when its category is deleted or turned into a `trasferimento` category (see `categories.md`).

## Shared type: `Budget`

Raw row of table `budgets`.

```ts
interface Budget {
  id: string;            // uuid
  userId: string;
  categoryId: string;    // uuid; unique per (userId, categoryId)
  monthlyAmount: string; // numeric(12,2) as STRING, e.g. "350.00" (always >= 0)
  createdAt: string;     // ISO-8601
  updatedAt: string;     // ISO-8601
}
```

## GET /api/budgets

> Spend and progress per budget (and the month total) are computed on the server by `GET /api/liquidity/month`
> (`budgets[]`, `budget`), see [liquidity.md](./liquidity.md). This route still returns only the configured amounts.
Route name: `budgets.list` · Auth: session cookie required

**Query params**: none. No pagination, no ordering guarantee (no ORDER BY).

**Response** `200` — `Budget[]`

```json
[
  { "id": "a1…", "userId": "u_…", "categoryId": "c9…", "monthlyAmount": "400.00", "createdAt": "2026-05-01T08:00:00.000Z", "updatedAt": "2026-09-01T08:00:00.000Z" }
]
```

The response contains only the configured amounts. Spent-vs-budget figures are NOT returned here (see Gaps in the report / analytics endpoints).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |

## PUT /api/budgets/{categoryId}
Route name: `budgets.upsert` · Auth: session cookie required · Guards: category ownership

**Path params**

| Name | Type | Required | Constraints |
|---|---|---|---|
| categoryId | string (uuid) | yes | category must belong to the user (404 otherwise); must not be of type `trasferimento` |

**Request body** (`application/json`, `upsertBudgetSchema`)

```ts
interface UpsertBudgetBody {
  monthlyAmount: number; // JSON number, min 0; stored with toFixed(2)
}
```

**Response** `200` (both for create and update) — the `Budget` row.

```json
{ "id": "a1…", "userId": "u_…", "categoryId": "c9…", "monthlyAmount": "250.00", "createdAt": "2026-05-01T08:00:00.000Z", "updatedAt": "2026-10-18T10:00:00.000Z" }
```

**Errors** (in evaluation order)

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ "error": "Categoria non trovata", "code": "category_not_found" }` | category does not exist or belongs to another user |
| 400 | `{ "error": "I trasferimenti sono esclusi dal budget", "code": "transfer_without_budget" }` | category type is `trasferimento` (checked before body parsing) |
| 400 | `{ "error": "<first zod issue message>", "code": "validation_failed", "field": "<path>" }` | invalid body (missing / negative / non-number) |
| 500 | `{ "error": "Errore interno", "code": "internal_error" }` | invalid JSON |

Budgets on the fallback category ("Da categorizzare") and on `entrata` categories are NOT rejected by the API (no check) — the web UI decides whether to offer them (unverified).

**Side effects**: `INSERT … ON CONFLICT (user_id, category_id) DO UPDATE SET monthly_amount, updated_at`.

**Mobile notes**
- Idempotent (PUT semantics) — safe to retry.
- Budgets are monthly amounts with no currency field; currency is the user's profile currency (EUR).

## DELETE /api/budgets/{categoryId}
Route name: `budgets.remove` · Auth: session · Since web #432 (the category detail's `Budget al mese` emptied).

**Response** `204` — also when no budget existed (idempotent); the `userId` filter keeps other users' rows out of reach. Log `budget.monthly.removed` with `count`.

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |

