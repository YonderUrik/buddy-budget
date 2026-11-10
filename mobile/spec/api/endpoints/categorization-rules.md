# Categorization rules

Feature area(s): Settings > Categorization rules (rule list/edit/delete), Movements ("Ricordala" — remember this choice), Categorize (rules are also created by `POST /api/transactions/categorize-apply`)
Source: `app/api/categorization-rules/route.ts`, `app/api/categorization-rules/[id]/route.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | `/api/categorization-rules` | List rules (by hit count) with category name and merchant logo path | session | — |
| POST | `/api/categorization-rules` | Create a manual rule (or replace an existing one with `replaceExisting`) and apply it immediately | session | synchronous; no demo-guard |
| PATCH | `/api/categorization-rules/{id}` | Update a rule and apply it immediately | session | synchronous |
| DELETE | `/api/categorization-rules/{id}` | Delete a rule | session | — |

## Shared type: `CategorizationRule`

```ts
type RuleMatchType = "merchant" | "contains"; // merchant = exact match on normalized merchant key; contains = substring of the key
type RuleSource = "appresa" | "manuale";       // appresa = learned from a confirmation in Categorize; manuale = created via this API

interface CategorizationRule {
  id: string;                  // uuid
  userId: string;
  matchType: RuleMatchType;
  pattern: string;             // ALREADY NORMALIZED with merchantKey() (server normalizes whatever you send)
  categoryId: string;          // uuid
  splitPercentage: string | null; // numeric(5,4) as STRING fraction 0..1, e.g. "0.5000"; null = no split
  source: RuleSource;
  hitCount: number;            // integer
  lastAppliedAt: string | null;// ISO-8601
  createdAt: string;
  updatedAt: string;
}
```

Rule resolution (for context, `lib/categorization/match-rule.ts`): for a transaction's merchant key, exact `merchant` rules win; otherwise the longest matching `contains` pattern (ties: most recent). Rules whose category direction is incompatible with the transaction sign are skipped (`isDirectionCompatible`: fallback and `trasferimento` accept both signs; `entrata` only positive; expense groups only negative).

## GET /api/categorization-rules
Route name: `categorization_rules.list` · Auth: session cookie required

**Response** `200` — array ordered by `hitCount` desc. No pagination.

```ts
type ListedRule = CategorizationRule & {
  categoryName: string;      // category name; default categories localized in the user's language (G11, branch feat/mobile-api-foundations)
  logoPath: string | null;   // relative URL of the merchant logo on our server, see merchant-logos.md
};
```

```json
[
  {
    "id": "9e…", "userId": "u_…", "matchType": "merchant", "pattern": "esselunga",
    "categoryId": "1c…", "splitPercentage": null, "source": "appresa", "hitCount": 37,
    "lastAppliedAt": "2026-10-15T06:00:00.000Z", "createdAt": "2026-04-02T10:00:00.000Z", "updatedAt": "2026-04-02T10:00:00.000Z",
    "categoryName": "Spesa", "logoPath": "/api/merchant-logos/esselunga.it"
  }
]
```

`logoPath` is computed with label = `pattern`, no other texts, and "is expense" = category type not `entrata`/`trasferimento`. Name-search logos are only attempted for expense rules.

**Errors**: 401 empty.

**Side effects**: Redis — records the user's (hashed) presence for name-searchable merchants (used to decide when a brand is common enough to look up). Redis failures are swallowed.

## POST /api/categorization-rules
Route name: `categorization_rules.create` · Auth: session cookie required

**Request body** (`createRuleSchema`)

```ts
interface CreateRuleBody {
  matchType: "merchant" | "contains";
  pattern: string;               // trimmed, min 1; server normalizes with merchantKey() before compare/store
  categoryId: string;            // uuid, owned, not the fallback
  splitPercentage?: number | null; // JSON number 0..1 (fraction, NOT percent); stored toFixed(4); null/absent = no split
  replaceExisting?: boolean;     // if a rule with same (matchType, normalized pattern) exists, update its category/split instead of 409
}
```

**Response**
- `201` (new rule) or `200` (existing rule replaced via `replaceExisting`) — `CategorizationRule & { applied: number; pastMatches: number }`
  - `applied`: number of transactions still in the fallback ("Da categorizzare") that ALL user rules just categorized (not only this rule).
  - `pastMatches`: number of already auto-categorized (or legacy) transactions whose category would change if this rule were applied to the past (feeds the "Apply also to the N past ones" prompt -> `POST /api/transactions/recategorize` with `scope:"regola"`). Returns 0 on internal error.
  - No `categoryName` / `logoPath` here.

```json
{ "id": "9e…", "userId": "u_…", "matchType": "contains", "pattern": "amazon", "categoryId": "4f…", "splitPercentage": "0.5000", "source": "manuale", "hitCount": 0, "lastAppliedAt": null, "createdAt": "2026-10-18T10:00:00.000Z", "updatedAt": "2026-10-18T10:00:00.000Z", "applied": 3, "pastMatches": 12 }
```

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ "error": "<first zod issue message>" }` | validation |
| 404 | `{ "code": "not_found" }` (generic) | category not found / not owned |
| 400 | `{ "error": "Non si può creare una regola sulla categoria di fallback", "code": "bad_request" }` (generic) | category is the fallback |
| 409 | `{ "error": "Esiste già una regola con questo pattern", "code": "conflict" }` (generic) | duplicate (matchType, normalized pattern) and no `replaceExisting` |
| 500 | `{ "error": "Errore interno" }` | invalid JSON |

**Side effects**
- Insert (source `"manuale"`) or update of `categorization_rules`. Note: when replacing, the existing rule keeps its original `source` (may stay `"appresa"`).
- `applyRulesToUncategorized`: updates fallback transactions matched by any rule (`categorySource:"regola"`, `excludedAmount` from rule split, `categorizedAt` now), increments `hitCount`/`lastAppliedAt` of hit rules. Metrics/log `categorization.auto.applied`.
- Computes `pastMatches` (read-only).

## PATCH /api/categorization-rules/{id}
Route name: `categorization_rules.update` · Auth: session cookie required

**Request body** (`updateRuleSchema`, at least one key)

```ts
interface UpdateRuleBody {
  matchType?: "merchant" | "contains";
  pattern?: string;              // trimmed min 1, re-normalized with merchantKey()
  categoryId?: string;           // uuid, owned, not fallback
  splitPercentage?: number | null; // 0..1; null clears
}
```

**Response** `200` — `CategorizationRule & { applied: number; pastMatches: number }` (same meaning as POST).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ "code": "not_found" }` (generic) | rule not found / not owned (checked before body) |
| 400 | `{ "error": "<zod msg>" }` | validation (`"Nessun campo da aggiornare"` for `{}`) |
| 404 | `{ "code": "not_found" }` (generic) | new `categoryId` not owned |
| 400 | `{ "error": "Non si può creare una regola sulla categoria di fallback" }` | new category is fallback |
| 409 | `{ "error": "Esiste già una regola con questo pattern" }` | resulting (matchType, pattern) collides with another rule |
| 500 | `{ "error": "Errore interno" }` | invalid JSON |

**Side effects**: same as POST (immediate rule application to fallback transactions; `updatedAt` refreshed). Already-categorized transactions are NOT changed (use recategorize).

## DELETE /api/categorization-rules/{id}
Route name: `categorization_rules.delete` · Auth: session cookie required

**Response** `204` empty. **Errors**: 401 empty; 404 empty (not owned).

**Side effects**: deletes the rule only; transactions it categorized keep their category and `categorySource:"regola"`.

## Mobile notes
- `splitPercentage` is a fraction (0..1) both in requests (number) and responses (string with 4 decimals).
- Display `pattern` as is (normalized lower-case key). `categoryName` is localized on the server (same rule as `GET /api/categories`).
- After POST/PATCH, refresh transactions, attention counts and categorize-suggestions (rules may have categorized fallback transactions). If `pastMatches > 0`, offer "apply to past" via `GET/POST /api/transactions/recategorize?scope=regola&ruleId=…`.
- `logoPath` is relative to the web origin and requires the session cookie (see `merchant-logos.md`).
