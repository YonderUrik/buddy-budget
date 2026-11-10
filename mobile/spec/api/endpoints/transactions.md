# Transactions

Feature area(s): Liquidity > Movements (list, add manual expense/income, edit, split "Dividi", note, delete), sidebar/Overview "Da sistemare" badge (attention), Categorize page (suggestion cards, "Messe dall'app" review, AI suggestions), Recategorize ("Ricategorizza")
Source: `app/api/transactions/**/route.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | `/api/transactions` | Legacy: every transaction in a date range, by direction. Paged (native apps): `limit`/`cursor` + Movimenti filters | session | paged mode on `feat/mobile-api-foundations` (gaps.md G4) |
| POST | `/api/transactions` | Create a manual transaction | session | demo-guard; may auto-apply rules |
| PATCH | `/api/transactions/{id}` | Update category / split / note (+ description/amount/date for manual) | session | — |
| DELETE | `/api/transactions/{id}` | Delete a manual transaction | session | — |
| GET | `/api/transactions/attention` | Counts of new + uncategorized transactions | session | polled by sidebar on every page |
| POST | `/api/transactions/attention/seen` | Mark imported transactions as seen | session | — |
| GET | `/api/transactions/auto-categorized` | «Messe dall'app»: groups categorized automatically in the last 30 days (web #456) | session | max 1000 rows |
| GET | `/api/transactions/{id}` | Movement detail: origin, account, rule, merchant summary (TX-064…073, web #455) | session | — |
| POST | `/api/transactions/{id}/ai-suggestion` | «Chiedi all'AI»: one category proposal for this movement (TX-068) | session | AI rate limit |
| POST | `/api/transactions/categorize-apply` | Apply category choices in bulk (+ learn rules) | session | atomic batch |
| POST | `/api/transactions/categorize-auto` | Apply rules + confident suggestions now | session | synchronous |
| GET | `/api/transactions/categorize-suggestions` | Uncategorized transactions grouped by merchant with suggestion | session | no LLM call |
| POST | `/api/transactions/categorize-suggestions/generate` | Ask the AI assistant for suggestions (background) | session | fire-and-forget `after()`, no jobId; LLM (OpenRouter) |
| GET | `/api/transactions/recategorize` | Preview recategorization | session | read-only |
| POST | `/api/transactions/recategorize` | Apply recategorization | session | synchronous (documented exception to job standard) |
| POST | `/api/transactions/recategorize/undo` | Undo last recategorization (within 7 days) | session | — |

## Shared type: `Transaction`

Raw row of table `transactions` (`lib/db/schema/transactions.ts`). Encrypted columns (`description`, `rawDescription`, `note`) are decrypted before JSON.

```ts
type CategorySource = "regola" | "storico" | "assistente" | "utente";
//  regola     = applied by a user rule
//  storico    = confident suggestion derived from the user's past choices
//  assistente = confident suggestion from the AI assistant
//  utente     = chosen by the user
//  null       = legacy (before tracking) or still in the fallback category

interface Transaction {
  id: string;                     // uuid
  userId: string;
  accountId: string;              // uuid
  categoryId: string;             // uuid (never null; uncategorized = the user's fallback category "Da categorizzare")
  description: string;            // cleaned description (for bank tx may be creditor/debtor name)
  rawDescription: string | null;  // original bank remittance text (auto tx only); for tooltip
  merchantCategoryCode: string | null; // 4-digit MCC from bank, informational only
  note: string | null;            // user note, <= 500 chars
  amount: string;                 // numeric(12,2) STRING, SIGNED: negative = outflow, positive = inflow. e.g. "-42.90"
  excludedAmount: string;         // numeric(12,2) STRING, same sign as amount (or "0.00"); |excluded| <= |amount|
  categorySource: CategorySource | null;
  categoryConfidence: string | null; // numeric(5,4) STRING 0..1 (e.g. "0.9300"); null for rules/user choices
  categorizedAt: string | null;   // ISO-8601
  date: string;                   // "YYYY-MM-DD" (booking date)
  source: "manuale" | "auto";     // auto = imported by GoCardless bank sync (lib/gocardless/sync.ts); everything else (manual entry, CSV import presumably) = "manuale" (CSV import source unverified)
  externalId: string | null;      // bank transaction id (auto only)
  createdAt: string;              // ISO-8601 (for auto tx: import time — drives "new" in attention)
  updatedAt: string;              // ISO-8601
}
```

### Money semantics
- **Sign = direction.** The sign of `amount` is the source of truth for income (`> 0`) vs expense (`< 0`).
- **Split ("Dividi") / excluded amount.** `excludedAmount` is the part of the amount excluded from statistics/budgets (e.g. a shared expense paid for someone else). Counted amount = `amount - excludedAmount`. Invariant (app-level only, `isValidExcludedAmount`): `excludedAmount` is `0` or has the same sign as `amount`, and `|excludedAmount| <= |amount|`.
- **Transfers.** A transaction whose category has type `trasferimento` always has `excludedAmount == amount` (fully excluded). Moving it out of a transfer category resets `excludedAmount` to `0` (unless the same PATCH sends `excludedAmount`).

### Category direction rules (`isDirectionCompatible`)
| Category | Allowed transaction sign |
|---|---|
| fallback (`isFallback: true`) | both |
| `trasferimento` | both |
| `entrata` | positive only |
| `dovuta`, `voluta`, `futuro`, `saltuaria` | negative only |

## GET /api/transactions
Route name: `transactions.list` · Auth: session required (Bearer or cookie)

Two modes, chosen by the query:

- **Paged** (native apps, gaps.md **G4**, branch `feat/mobile-api-foundations`): when `limit` or `cursor` is present.
  Returns `{ items, nextCursor }`. **Use this on mobile.**
- **Legacy** (web): otherwise. Returns the whole window as an array, unchanged.

### Paged mode

**Query params**

| Name | Type | Required | Default | Constraints / meaning |
|---|---|---|---|---|
| limit | int | no (one of `limit`/`cursor`) | `50` | 1–200 |
| cursor | string | no | — | opaque `nextCursor` of the previous page; keep every other param identical between pages |
| from | string | no | none (all history) | `YYYY-MM-DD`, inclusive |
| to | string | no | none | `YYYY-MM-DD`, inclusive |
| type | string | no | **`tutte`** | `uscita` (amount < 0) \| `entrata` (amount > 0) \| `tutte`. Note: the default differs from the legacy mode |
| accountId | uuid | no | — | only this account (the account chips) |
| categoryId | uuid | no | — | only this category (category filter chip) |
| q | string | no | — | case-insensitive substring of `description` **or** `note`, trimmed (the search box) |
| uncategorized | `1` | no | — | only transactions on the fallback category («Da sistemare» toggle) |

Filters combine with AND, exactly as the web's Movimenti screen (`filterTransactions` + `filterByTransactionType` +
fallback check, `lib/liquidity/transactions-list.ts`). Order: `date` desc, then `id` desc (stable, so pages never
overlap or skip rows, also inside a day). New transactions inserted while paging appear on a refresh, not mid-walk.

Performance: every filter except `q` runs in SQL with `LIMIT limit+1`. Descriptions and notes are encrypted at rest, so
with `q` the server reads the window decrypted and filters in memory — prefer adding `from`/`to` when searching.

**Response** `200`

```ts
interface TransactionPage {
  items: ListedTransaction[];   // same row shape as the legacy mode (Transaction + logoPath)
  nextCursor: string | null;    // null on the last page
}
```

```json
{
  "items": [
    { "id": "d5b0cc79-4e40-4148-8564-33bb66700a84", "userId": "H4N8DHkvtJccXC14RUNjb6sYfBe49qUl", "accountId": "88524cc8-7e96-40d4-811a-b2c02ef824db",
      "categoryId": "5b6d7cf8-39f7-4917-bc2b-4b5872cfd283", "description": "Giroconto al conto deposito", "rawDescription": null,
      "merchantCategoryCode": null, "note": null, "amount": "-250.00", "excludedAmount": "-250.00", "categorySource": null,
      "categoryConfidence": null, "categorizedAt": null, "date": "2026-10-18", "source": "auto",
      "externalId": "demo-transfer-88524cc8-7e96-40d4-811a-b2c02ef824db", "createdAt": "2026-10-18T14:45:23.559Z",
      "updatedAt": "2026-10-18T14:45:23.559Z", "logoPath": null }
  ],
  "nextCursor": "MjAyNi0xMC0xMHxiZmRhOTZlNy0zZDI5LTQ2NGQtYmFiMi1lY2NiMTRkNzdhMmY"
}
```

Fixtures: [transactions-page.json](../fixtures/transactions-page.json) (`limit=20`), [transactions-page-2.json](../fixtures/transactions-page-2.json)
(next page), [transactions-page-filtered.json](../fixtures/transactions-page-filtered.json) (`type=uscita&q=supermercato`),
[transactions-page-uncategorized.json](../fixtures/transactions-page-uncategorized.json) (`uncategorized=1`).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ "error": "limit deve essere un intero tra 1 e 200", "code": "validation_failed", "field": "limit" }` | bad limit |
| 400 | `{ "error": "Cursore non valido", "code": "invalid_cursor" }` | cursor not produced by the server |
| 400 | `{ "error": "accountId non valido", "code": "validation_failed", "field": "accountId" }` (same for `categoryId`) | not a UUID |
| 400 | `{ "error": "from e to devono avere formato YYYY-MM-DD", "code": "invalid_date" }` | bad date format |
| 400 | `{ "error": "type deve essere uno tra uscita, entrata, tutte", "code": "invalid_type" }` | bad type |

The month figures shown above the feed come from `GET /api/liquidity/month` ([liquidity.md](./liquidity.md)).

### Legacy mode (web)

**Query params**

| Name | Type | Required | Default | Constraints |
|---|---|---|---|---|
| from | string | yes | — | `YYYY-MM-DD` (regex only, not calendar-validated), inclusive |
| to | string | yes | — | `YYYY-MM-DD`, inclusive |
| type | string | no | `uscita` | `uscita` (amount < 0) \| `entrata` (amount > 0) \| `tutte` (all, incl. amount = 0) |

No other filters and no pagination: the whole range is returned. Note the default `type=uscita`.

Order: `date` descending (no secondary sort key; order within the same date is not guaranteed).

**Response** `200` — `ListedTransaction[]`

```ts
type ListedTransaction = Transaction & { logoPath: string | null }; // see merchant-logos.md
```

`logoPath` is computed from `description` + `rawDescription`; name-based lookup only for expenses.

```json
[
  {
    "id": "3a0e…", "userId": "u_…", "accountId": "6f1c…", "categoryId": "1c2d…",
    "description": "Esselunga", "rawDescription": "PAGAMENTO POS ESSELUNGA MILANO 14/10", "merchantCategoryCode": "5411",
    "note": null, "amount": "-58.40", "excludedAmount": "0.00",
    "categorySource": "regola", "categoryConfidence": null, "categorizedAt": "2026-10-15T06:00:03.120Z",
    "date": "2026-10-14", "source": "auto", "externalId": "2026101400123",
    "createdAt": "2026-10-15T06:00:01.000Z", "updatedAt": "2026-10-15T06:00:03.120Z",
    "logoPath": "/api/merchant-logos/esselunga.it"
  }
]
```

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ "error": "from e to sono obbligatori (YYYY-MM-DD)", "code": "invalid_date_range" }` | from or to missing |
| 400 | `{ "error": "from e to devono avere formato YYYY-MM-DD", "code": "invalid_date" }` | bad format |
| 400 | `{ "error": "type deve essere uno tra uscita, entrata, tutte", "code": "invalid_type" }` | bad type |

**Side effects**: Redis presence record for name-searchable merchants (non-fatal).

## POST /api/transactions
Route name: `transactions.create` · Auth: session cookie required · Guards: `rejectIfDemoActive`

**Request body** (`createTransactionSchema`)

```ts
interface CreateTransactionBody {
  accountId: string;            // uuid; owned; account.source must be "manuale"
  description: string;          // trimmed, min 1
  categoryId: string;           // uuid; owned
  amount: number;               // JSON number, POSITIVE (> 0) magnitude; sign is derived server-side
  direction?: "entrata" | "uscita"; // only used when category type is "trasferimento"
  date: string;                 // regex ^\d{4}-\d{2}-\d{2}$ (message "Data non valida")
}
```

Sign derivation: positive if category type is `entrata`, or `trasferimento` with `direction:"entrata"`; otherwise negative (expense groups, fallback, and `trasferimento` without direction / with `uscita`). Note: a fallback category always yields an expense.
`excludedAmount` = signed amount for `trasferimento`, else `"0"`.
If the category is not the fallback: `categorySource:"utente"`, `categorizedAt: now`. If it is the fallback, all user rules are immediately applied to uncategorized transactions; the response then returns the re-read row (possibly categorized by a rule, `categorySource:"regola"`).

**Response** `201` — `Transaction` (no `logoPath`).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 409 | `{ "error": "Stai esplorando i dati d'esempio: azzerali per aggiungere i tuoi.", "code": "demo_active" }` | demo active |
| 400 | `{ "error": "<first zod issue message>", "code": "validation_failed", "field": "<path>" }` | validation |
| 400 | `{ "error": "Conto non valido", "code": "invalid_account" }` | account not found / not owned |
| 400 | `{ "error": "Non si può aggiungere una spesa manuale a un conto collegato", "code": "linked_account_read_only" }` | account is `source:"auto"` |
| 400 | `{ "error": "Categoria non valida", "code": "invalid_category" }` | category not found / not owned |
| 500 | `{ "error": "Errore interno", "code": "internal_error" }` | invalid JSON |

**Side effects**: insert; possibly `applyRulesToUncategorized` (updates other fallback transactions too, bumps rule hit counts). Account `balance` is NOT changed by this route.

## PATCH /api/transactions/{id}
Route name: `transactions.update` · Auth: session cookie required · Guards: ownership

**Request body** (`updateTransactionSchema`, at least one key)

```ts
interface UpdateTransactionBody {
  description?: string;     // trimmed, min 1          — manual only
  categoryId?: string;      // uuid, owned
  amount?: number;          // > 0 magnitude            — manual only; sign derived server-side
  date?: string;            // YYYY-MM-DD               — manual only
  excludedAmount?: number;  // >= 0 magnitude; sign forced to the (new) amount's sign
  note?: string | null;     // trimmed, max 500 ("La nota non può superare 500 caratteri"); "" or null clears
}
```

**Server logic (in order)**
1. 404 if not owned (before body parsing). Zod -> 400.
2. If `source:"auto"` and body contains `description`, `amount` or `date` -> 403.
3. If `categoryId` given: must be owned (400 `"Categoria non valida"`).
4. Direction check: when changing category WITHOUT sending `amount`, and the new category is not fallback and not `trasferimento`, then (`newCategory.type === "entrata"`) must equal (current amount > 0) -> otherwise 400.
5. New sign: from the new category if it is non-fallback, non-transfer (`entrata` => +, else −); otherwise keeps the current sign. New amount = sign × `amount` if sent, else the current amount.
6. `excludedAmount` (if sent) gets the new amount's sign. If the resulting category is `trasferimento` -> `excludedAmount = amount` (overrides the sent value). If leaving `trasferimento` and `excludedAmount` not sent -> `0`.
7. If `amount` or `excludedAmount` was sent, validates `isValidExcludedAmount(newAmount, excluded)` -> 400 `"Quota esclusa non valida"`.
8. Provenance: category actually changed to non-fallback -> `categorySource:"utente"`, `categoryConfidence:null`, `categorizedAt:now`; changed to fallback -> all three `null`. Category unchanged but `excludedAmount` changed by hand on an automatically categorized transaction -> becomes `"utente"` (so Recategorize won't override it).

**Response** `200` — updated `Transaction` (no `logoPath`).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ "error": "Movimento non trovato", "code": "transaction_not_found" }` | not found / not owned |
| 400 | `{ "error": "<zod msg>", "code": "validation_failed", "field": "<path>" }` | validation (`"Nessun campo da aggiornare"`, `"Data non valida"`, …) |
| 403 | `{ "error": "Per una transazione automatica sono modificabili solo categoria e \"Dividi\"", "code": "linked_transaction_field_locked" }` | manual-only field on auto tx (note IS allowed) |
| 400 | `{ "error": "Categoria non valida", "code": "invalid_category" }` | category not owned |
| 400 | `{ "error": "La categoria scelta non è compatibile con la direzione della transazione", "code": "category_direction_mismatch" }` | direction mismatch |
| 400 | `{ "error": "Quota esclusa non valida", "code": "invalid_excluded_amount" }` | split invariant violated |
| 500 | `{ "error": "Errore interno", "code": "internal_error" }` | invalid JSON |

**Side effects**: update row; metrics/log `categorization.auto.corrected` when the user overrides an automatic category.

## DELETE /api/transactions/{id}
Route name: `transactions.delete`

**Response** `204` empty.

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ "error": "Movimento non trovato", "code": "transaction_not_found" }` | not found / not owned |
| 400 | `{ "error": "Una transazione automatica non può essere eliminata", "code": "linked_transaction_not_deletable" }` | `source:"auto"` |

Hard delete; no account balance change.

## GET /api/transactions/attention
Route name: `transactions.attention` (logged quietly on success) · Auth: session

**Response** `200`

```ts
interface AttentionSummary {
  newCount: number;            // auto (bank) transactions with createdAt > user.movementsSeenAt
  uncategorizedCount: number;  // transactions in the fallback category
  totalCount: number;          // distinct transactions that are new OR uncategorized
  newTransactionIds: string[]; // ids of new transactions, at most 200
}
```

```json
{ "newCount": 4, "uncategorizedCount": 11, "totalCount": 13, "newTransactionIds": ["3a0e…", "77b1…"] }
```

All zeros / empty array if the user row is missing. Errors: 401 empty.

## POST /api/transactions/attention/seen
Route name: `transactions.attention_seen` · No body.

Sets `user.movementsSeenAt = now` (called when opening the movements screens). **Response** `204` empty. Errors: 401 empty.

## GET /api/transactions/auto-categorized
Route name: `transactions.auto_categorized` · Auth: session

Transactions with `categorySource ∈ {regola, storico, assistente}` and `categorizedAt > user.autoCategorizedSeenAt`, newest `categorizedAt` first, **capped at 1000 rows**, grouped by merchant key + direction + category + source.

**Response** `200`

```ts
interface AutoCategorizedResponse {
  groups: AutoCategorizedGroup[];
  total: number;   // number of rows fetched (<= 1000), not number of groups
}
interface AutoCategorizedGroup {
  groupKey: string;            // "<merchantKey>::<entrata|uscita>::<categoryId>::<source>"
  merchantKey: string;
  label: string;               // description of most recent tx
  categoryId: string;
  source: "regola" | "storico" | "assistente";
  confidence: number | null;   // JSON NUMBER, lowest in group; null for rules
  transactionIds: string[];
  transactionDescriptions: string[]; // same order as ids
  transactionDates: string[];        // "YYYY-MM-DD"
  transactionAmounts: number[];      // JSON NUMBERS, signed
  totalAmount: number;               // JSON NUMBER, signed, rounded to cents
  lastCategorizedAt: string;         // ISO-8601
  bankCategory: string | null;       // source `banca`: the bank's label in the imported file (CAT-098)
  logoPath: string | null;
}
```

Groups sorted by `lastCategorizedAt` desc, then size desc; within a group by date desc.

**Errors**: 401 empty; 404 empty if the user row doesn't exist.

## Removed: POST /api/transactions/auto-categorized/seen
Web #456 turned «Messe dall'app» into a 30-day history with nothing to confirm: no «Va tutto bene», no `seenAt` in the
auto-categorized response. The apps no longer call it (CAT-081 removed).

## GET /api/transactions/{id}
Route name: `transactions.detail` · 404 when the movement is not the user's.
```ts
{
  transaction: Transaction & { bankCategory: string | null; merchantCategoryCode: string | null; createdAt: string };
  account: { id: string; name: string } | null;
  origin: { kind: "banca" | "file" | "broker" | "esempio" | "manuale"; institution?: string; format?: string; broker?: string };
  rule: { id: string; matchType: "merchant" | "contains"; pattern: string } | null; // the user's rule still matching
  merchant: { count: number; total: number; recent: { id: string; date: string; amount: number }[] } | null; // last year
}
```
Sentences built on the device: `MovementDetailText` (TX-067, TX-069, TX-071).

## POST /api/transactions/{id}/ai-suggestion
Route name: `transactions.ai_suggestion` · no body · 404 for another user's movement.
Answers `{ status: "ok", categoryId, confidence }` or `{ status }` with `disabled`, `no_key`, `blocked` (transfer or
person: never sent), `limited` (hourly limit) or `failed`. Nothing is saved: «Usa questa» is a normal PATCH.

## POST /api/transactions/categorize-apply
Route name: `transactions.categorize_apply` · Auth: session

**Request body** (`applyCategorizationSchema`)

```ts
interface CategorizeApplyBody {
  groups: Array<{                  // min 1
    transactionIds: string[];      // uuids, min 1; all must be owned
    categoryId: string;            // uuid; owned
    excludedPercentage?: number;   // 0..1, default 0; forced to 1 for trasferimento categories
    createRule?: boolean;          // default TRUE: upsert an "appresa" merchant rule
    merchantKey: string;           // trimmed min 1; the rule pattern (use the group's merchantKey)
  }>;
}
```

Per transaction: `excludedAmount = sign(amount) × round(|amount| × excludedPercentage, 2)`, `categorySource:"utente"`, `categoryConfidence:null`, `categorizedAt: now`. With `createRule`: upsert on (user, `"merchant"`, merchantKey) setting category and `splitPercentage` (`excludedPercentage.toFixed(4)` or null when 0). All in one DB transaction (all-or-nothing).

**Response** `200`

```json
{ "applied": 12, "rulesCreated": 2 }
```
`applied` = transactions updated; `rulesCreated` = rules newly inserted (updates of existing rules not counted).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ "error": "<zod msg>" }` | validation |
| 404 | empty | any category or transaction not owned/not found (also if `transactionIds` contain unknown ids) |
| 400 | `{ "error": "La categoria scelta non è compatibile con la direzione della transazione" }` | any tx incompatible (whole batch rejected) |
| 500 | `{ "error": "Errore interno", "code": "internal_error" }` | invalid JSON |

**Side effects**: updates transactions, upserts `categorization_rules`; marks stored AI suggestions as confirmed/corrected (`categorization_suggestions`); metrics for auto-corrections.

## POST /api/transactions/categorize-auto
Route name: `transactions.categorize_auto` · No body.

Applies user rules to fallback transactions, then (only if the user enabled auto-apply) confident suggestions (confidence ≥ 0.9; `storico` additionally needs ≥ 3 agreeing past transactions; `assistente` needs active AI consent). Idempotent.

**Response** `200`

```json
{ "applied": 9, "groups": 3, "bySource": { "regola": 4, "storico": 3, "assistente": 2 } }
```
`applied` = total transactions; `groups` = merchant groups applied by confident suggestions (rule applications not counted); `bySource` per `categorySource`.

Errors: 401 empty.

## GET /api/transactions/categorize-suggestions
Route name: `transactions.categorize_suggestions`

Fallback-category transactions grouped by merchant key + direction, each with the best stored/computed suggestion. Never calls the LLM.

**Response** `200`

```ts
interface CategorizeSuggestionsResponse {
  groups: SuggestionGroup[];
  autoApply: {
    enabled: boolean;   // user preference "apply confident suggestions automatically"
    ready: number;      // = readyKeys.length
    readyKeys: string[];// groupKeys that would auto-apply now -> client calls POST categorize-auto and hides them
  };
}
interface SuggestionGroup {
  groupKey: string;                  // "<merchantKey>::<entrata|uscita>"
  merchantKey: string;
  label: string;
  transactionIds: string[];
  transactionDescriptions: string[]; // same order
  transactionDates: string[];        // "YYYY-MM-DD"
  transactionAmounts: number[];      // JSON numbers, signed
  totalAmount: number;               // JSON number, signed
  suggestion: CategorizeSuggestion | null;
  hasDivergentSuggestions: boolean;  // transactions in the group had different suggestions
  logoPath: string | null;
}
interface CategorizeSuggestion {
  transactionId: string;
  merchantKey: string;
  suggestedCategoryId: string;
  source: "regola" | "storico" | "assistente";
  confidence: number;                // 0..1, JSON number
  reason: string;                    // Italian human text, e.g. 'Simile alla regola "esselunga"', "Come 3 transazioni passate", "Proposta dall'assistente"
  suggestedSplitPercentage: number | null; // 0..1
  history?: { agreeing: number; total: number }; // storico only
  rulePattern?: string;              // regola only
}
```

Errors: 401 empty. Cost note: loads ALL user transactions server-side (can be slow for large histories).

## POST /api/transactions/categorize-suggestions/generate
Route name: `transactions.categorize_suggestions_generate` · `maxDuration = 300` · No body.

**Response** `200` always (status in body):

| Body | Meaning |
|---|---|
| `{ "status": "no_key" }` | server has no `OPENROUTER_API_KEY` (AI unavailable) |
| `{ "status": "disabled" }` | user has not given AI-categorization consent (`aiCategorizationConsentAt` null) |
| `{ "status": "started" }` | work scheduled in `after()` |

Background work: AI suggestions for up to 600 merchant groups within 240 s (LLM via OpenRouter; merchant texts sent to the LLM), then rules + confident suggestions auto-apply. **No jobId and no status endpoint**: the client polls/reloads `GET categorize-suggestions` to see suggestions appear.

Errors: 401 empty.

## GET /api/transactions/recategorize
Route name: `transactions.recategorize_preview` · Read-only, no LLM.

**Query params**

| Name | Type | Required | Default | Notes |
|---|---|---|---|---|
| scope | string | no | (anything other than `regola` => `tutto`) | `regola` \| `tutto` |
| ruleId | string | if scope=regola | — | must match `/^[0-9a-f-]{36}$/i`, else 400 |
| legacy | `"1"` | no | — | scope=tutto only: include legacy transactions (categorySource null, not manually split) |

Candidates: transactions whose current category was set automatically (`regola`/`storico`/`assistente`), plus legacy ones if requested; never `utente`. Proposed new category from current rules (and confident suggestions only if auto-apply is enabled).

**Response** `200`

```ts
interface RecategorizePreviewResponse {
  groups: Array<{
    key: string;              // "<merchantKey>::<direction>::<fromCategoryId>::<toCategoryId>::<source>::<percentage>" — pass to POST groupKeys
    label: string;
    fromCategoryId: string;
    toCategoryId: string;
    source: "regola" | "storico" | "assistente";
    confidence: number | null;
    count: number;
    legacyCount: number;
    firstDate: string;        // YYYY-MM-DD
    lastDate: string;
    totalAmount: number;      // JSON number, signed
    logoPath: string | null;
  }>;
  changes: number;            // transactions that would change
  legacyChanges: number;      // of which legacy
  legacyAvailable: number;    // scope=tutto without legacy: how many legacy ones would change if included; else 0
  autoApply: boolean;         // user auto-apply preference (false => only rules are used)
  lastRun: { id: string; changed: number; createdAt: string } | null; // last undoable run (<= 7 days)
}
```

Errors: 401 empty; 400 `{ "error": "Regola non valida" }` (bad ruleId). Unknown/foreign ruleId: behaviour not explicitly checked (likely empty plan — unverified).

## POST /api/transactions/recategorize
Route name: `transactions.recategorize_apply` · synchronous

**Request body** (`recategorizeApplySchema`)

```ts
interface RecategorizeApplyBody {
  scope: "tutto" | "regola";
  includeLegacy?: boolean;   // default false (tutto only)
  ruleId?: string;           // uuid, REQUIRED when scope="regola" ("Manca la regola")
  groupKeys?: string[];      // each 1..2000 chars, max 5000 items; omitted => all groups
}
```

The plan is recomputed on current data; groups that changed meanwhile are skipped. Only rows still in the `from` category and not `utente` are updated.

**Response** `200`

```json
{ "runId": "b5…", "changed": 27, "groups": 4 }
```
`runId` is `null` when nothing changed (no undo possible).

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ "error": "<first zod issue>" }` | validation (invalid JSON -> body null -> zod message) |
| 500 | `{ "error": "Non è stato possibile ricategorizzare. Riprova." }` | internal failure |

**Side effects**: updates transactions (new `categorySource`/confidence/`categorizedAt`, so they reappear in "Messe dall'app"), writes `categorization_runs` + items for undo, deletes runs older than 30 days, bumps rule hits, metrics.

## POST /api/transactions/recategorize/undo
Route name: `transactions.recategorize_undo`

**Request body**: `{ runId: string /* uuid */ }`

Only the latest non-undone run of the last 7 days can be undone. Restores category, excludedAmount, source, confidence, categorizedAt on transactions not changed since (and whose previous category still exists).

**Response** `200` `{ "restored": 25 }`

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ "error": "<zod msg>" }` | invalid runId |
| 404 | `{ "error": "Questa ricategorizzazione non si può più annullare" }` | not the latest undoable run / too old / already undone |

## Mobile notes
- Amount fields: `Transaction.amount/excludedAmount/categoryConfidence` are **strings**; in categorize/auto-categorized/recategorize payloads amounts and confidences are **JSON numbers**. Request bodies always use numbers (positive magnitudes for `amount`/`excludedAmount`).
- Use the **paged mode** of `GET /api/transactions` (`limit`, `cursor`, filters; default `type=tutte`). The legacy mode has no pagination and defaults to `type=uscita`.
- Every error body has a stable `code` (README §5); branch on it, not on `error`.
- The web invalidates `transactions` and `attention` after any create/update/delete; categorize mutations also invalidate suggestions/auto-categorized/rules.
- Manual transactions cannot be added to bank-linked accounts; bank transactions cannot be deleted and only `categoryId`, `excludedAmount`, `note` are editable.
- AI generation is fire-and-forget: show a "working" state and refetch `categorize-suggestions` periodically (web reloads the list).
- `logoPath` URLs require the session (send the `Authorization` header from the image loader, see `merchant-logos.md`).

## Cross-cutting observations
- Routes using `readJson` (`auto-categorized/seen`, `recategorize`, `recategorize/undo`) turn invalid JSON into a 400; routes using `request.json()` directly (`POST /api/transactions`, `PATCH [id]`, `categorize-apply`) return a generic 500 `{ "error": "Errore interno" }`.
- `categorize-suggestions/generate` is a background task WITHOUT jobId/Redis status (deviates from the job standard); `recategorize` POST is intentionally synchronous.
- `GET /api/transactions/categorize-suggestions` returns `reason` strings in Italian regardless of locale.
