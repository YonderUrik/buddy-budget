# Accounts

Feature area(s): Liquidity > Accounts (account list, add manual account, edit/delete account), account pickers in "Add transaction", Settings > Bank connections (unlinking an auto account)
Source: `app/api/accounts/route.ts`, `app/api/accounts/[id]/route.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | `/api/accounts` | List all accounts of the user | session | — |
| POST | `/api/accounts` | Create a manual account | session | demo-guard (409 `demo_active`) |
| PATCH | `/api/accounts/{id}` | Update an account (auto accounts: name/color/icon only) | session | no demo-guard |
| DELETE | `/api/accounts/{id}` | Delete a manual account, or unlink an auto (bank) account | session | no demo-guard; may revoke GoCardless consent |

## Shared type: `Account`

Raw Drizzle row of table `accounts` (all columns, nothing omitted).

```ts
interface Account {
  id: string;            // uuid
  userId: string;        // better-auth user id (text, not uuid)
  name: string;
  type: string;          // FREE TEXT (not an enum). UI proposes: "Conto corrente" | "Conto risparmio" | "Conto deposito" | "Contanti"
  balance: string;       // numeric(12,2) serialized as STRING, e.g. "1234.50", may be negative "-20.00"
  color: SwatchColor;    // default "slate"
  icon: AccountIcon;     // default "wallet"
  source: "manuale" | "auto"; // "auto" = linked via GoCardless bank connection
  isDemo: boolean;       // true for sample-data accounts ("Esplora con dati d'esempio")
  createdAt: string;     // ISO-8601 timestamp
  updatedAt: string;     // ISO-8601 timestamp
}
```

`GET /api/accounts` adds `followsTransactions: boolean` to each row (web #447): `true` for linked banks and accounts fed
by file imports, whose past balance history is rebuilt from their transactions (the charts follow imports and edits);
`false` for manual accounts.

Enums (verbatim, `lib/validation/shared-colors.ts`, `lib/validation/accounts.ts`):

- `SwatchColor` (48 values): base (the only ones offered in pickers) `slate, blue, green, yellow, purple, orange, red, teal, pink, indigo, cyan, lime, amber, rose, violet, emerald`, plus each with `-light` suffix (`slate-light` … `emerald-light`) and `-dark` suffix (`slate-dark` … `emerald-dark`).
- `AccountIcon` (lucide icon names): `wallet, credit-card, banknote, building-2, piggy-bank, trending-up, home, car, plane, shopping-cart, briefcase, dollar-sign, bitcoin, landmark, coins, receipt, package, gift, heart, star, zap, coffee, shopping-bag, user, globe, smartphone, watch, graduation-cap, flame, music`.

Note: the DB column `color`/`icon` is plain text; values outside the enums can only exist if written by other code paths (e.g. bank sync / demo seed — unverified). Clients should fall back gracefully on unknown values.

## GET /api/accounts
Route name: `accounts.list` · Auth: session required · Guards: none

**Query params**

| Name | Type | Required | Default | Notes |
|---|---|---|---|---|
| include | string | no | — | `trend,health` (either value, comma-separated): adds the extras below to each account (native apps, gaps.md **G5**, branch `feat/mobile-api-foundations`). Unknown values → 400 |
| today | `YYYY-MM-DD` | no | server's day | only with `include`: the device's local day, end of the trend |

No pagination.

**Response** `200` — `Account[]`, ordered by `createdAt` ascending. Without `include` (web), exactly the raw rows:

```json
[
  {
    "id": "6f1c1b7e-2a7c-4d0e-9a51-3c8f0a1d2b3c",
    "userId": "u_8Hq2...",
    "name": "Conto Fineco",
    "type": "Conto corrente",
    "balance": "2450.30",
    "color": "blue",
    "icon": "landmark",
    "source": "auto",
    "isDemo": false,
    "createdAt": "2026-03-02T09:14:00.123Z",
    "updatedAt": "2026-10-17T05:00:12.000Z"
  }
]
```

With `include=trend,health`, each row is `Account & AccountExtras` (zod `accountExtrasSchema` in `lib/views/schemas.ts`),
computed with the functions of the web's Conti page (`buildAccountBalanceSeries`, `computeConnectionHealth`,
`needsRenewal`, `localizedAccountStatus().buildAccountStatus`, `isAccountSyncing`):

```ts
interface AccountExtras {
  bankName: string | null;          // institution of a linked account (group the list by it, as the web's groupAccounts); null for manual
  trend: number[] | null;           // linked accounts only: end-of-day balance for the 30 days before `today` plus today (31 points, oldest first), JSON numbers
  health: {                         // linked accounts with a bank connection; null otherwise
    connectionId: string; institutionName: string;
    state: "ok" | "expiring" | "expired" | "error" | "pending";
    needsRenewal: boolean;          // show "Rinnova" (expiring within 7 days, expired or error)
    daysLeft: number | null;        // days to consent expiry (ok / expiring)
    consentExpiresAt: string | null; lastSyncedAt: string | null;   // ISO
    syncing: boolean;               // a sync job is running for this account (/api/sync-jobs)
    eligible: boolean; nextEligibleAt: string | null; syncsRemainingToday: number; // manual sync availability (4 a day, 4 h apart)
  } | null;
  status: { tone: "ok" | "warning" | "progress" | "neutral"; label: string }; // localized line under the name: "Aggiornato da te", "Da riconnettere", "Aggiornato 3 ore fa", "Mai sincronizzato"…
}
```

Example (`include=trend,health&today=2026-10-18`; trend trimmed):

```json
[
  {
    "id": "15d545bd-3e34-4e39-a7b6-5f2b2eb5b466",
    "userId": "H4N8DHkvtJccXC14RUNjb6sYfBe49qUl",
    "name": "Conto deposito",
    "type": "Conto deposito",
    "balance": "17400.00",
    "color": "emerald",
    "icon": "piggy-bank",
    "source": "manuale",
    "isDemo": false,
    "createdAt": "2026-10-18T14:45:23.487Z",
    "updatedAt": "2026-10-18T14:45:23.487Z",
    "bankName": null,
    "trend": null,
    "health": null,
    "status": {
      "tone": "neutral",
      "label": "Aggiornato da te"
    }
  },
  {
    "id": "88524cc8-7e96-40d4-811a-b2c02ef824db",
    "userId": "H4N8DHkvtJccXC14RUNjb6sYfBe49qUl",
    "name": "Conto corrente",
    "type": "Conto corrente",
    "balance": "5050.34",
    "color": "blue",
    "icon": "landmark",
    "source": "auto",
    "isDemo": false,
    "createdAt": "2026-10-18T14:45:23.487Z",
    "updatedAt": "2026-10-18T14:45:23.487Z",
    "bankName": "Banca Demo",
    "trend": [
      5689.59,
      5689.59,
      5689.59,
      5586.15,
      5050.34
    ],
    "health": {
      "connectionId": "f4ba9de6-444c-4fb3-b5ef-d3f3e6cfe2b4",
      "institutionName": "Banca Demo",
      "state": "expiring",
      "needsRenewal": true,
      "daysLeft": 6,
      "consentExpiresAt": "2026-10-23T14:55:23.447Z",
      "lastSyncedAt": "2026-10-18T11:55:23.447Z",
      "syncing": false,
      "eligible": false,
      "nextEligibleAt": "2026-10-18T15:55:23.447Z",
      "syncsRemainingToday": 3
    },
    "status": {
      "tone": "warning",
      "label": "Da riconnettere"
    }
  }
]
```

Fixtures: [accounts.json](../fixtures/accounts.json) (raw), [accounts-include.json](../fixtures/accounts-include.json)
(with extras; the linked account has a dev-only fake connection expiring in 6 days).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ "error": "include accetta solo trend e health", "code": "validation_failed", "field": "include" }` | unknown include |
| 400 | `{ "error": "today deve avere formato YYYY-MM-DD", "code": "invalid_date", "field": "today" }` | malformed today |

**Side effects**: none.

## POST /api/accounts
Route name: `accounts.create` · Auth: session cookie required · Guards: `rejectIfDemoActive`

**Request body** (`application/json`, `createAccountSchema`)

```ts
interface CreateAccountBody {
  name: string;          // trimmed, min length 1
  type: string;          // trimmed, min length 1, free text
  balance: number;       // JSON number (NOT string); any finite number incl. negative; stored rounded with toFixed(2)
  color?: SwatchColor;   // optional; omitted -> DB default "slate"
  icon?: AccountIcon;    // optional; omitted -> DB default "wallet"
}
```

`source` is always forced to `"manuale"`. Auto accounts are only created through the bank-connection flow.

**Response** `201` — the created `Account`.

```json
{ "id": "…", "userId": "…", "name": "Contanti", "type": "Contanti", "balance": "150.00", "color": "green", "icon": "banknote", "source": "manuale", "isDemo": false, "createdAt": "2026-10-18T10:00:00.000Z", "updatedAt": "2026-10-18T10:00:00.000Z" }
```

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 409 | `{ "error": "Stai esplorando i dati d'esempio: azzerali per aggiungere i tuoi.", "code": "demo_active" }` | user has demo data active |
| 400 | `{ "error": "<first zod issue message>", "code": "validation_failed", "field": "<path>" }` | validation failure |
| 500 | `{ "error": "Errore interno", "code": "internal_error" }` | body is not valid JSON (`request.json()` throws, caught by `withRoute`) |

**Side effects**: inserts one `accounts` row.

## PATCH /api/accounts/{id}
Route name: `accounts.update` · Auth: session cookie required · Guards: ownership (404)

**Path params**

| Name | Type | Required | Constraints |
|---|---|---|---|
| id | string (uuid) | yes | must belong to the user, otherwise 404. A non-uuid value causes a Postgres cast error -> 500 (unverified, no explicit check) |

**Request body** (`application/json`, `updateAccountSchema`) — at least one key required.

```ts
interface UpdateAccountBody {
  name?: string;         // trimmed, min 1
  type?: string;         // trimmed, min 1   — forbidden for source="auto"
  balance?: number;      // JSON number      — forbidden for source="auto"
  color?: SwatchColor;
  icon?: AccountIcon;
}
```

Empty object -> 400 `"Nessun campo da aggiornare"`. Note: the presence check for auto accounts is `"type" in data || "balance" in data`, so sending those keys at all (even unchanged) for an auto account yields 403.

**Response** `200` — the updated `Account` (`updatedAt` refreshed).

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ "error": "Conto non trovato", "code": "account_not_found" }` | account not found / not owned (checked BEFORE body parsing) |
| 400 | `{ "error": "<first zod issue message>", "code": "validation_failed", "field": "<path>" }` | validation (e.g. `"Nessun campo da aggiornare"`) |
| 403 | `{ "error": "Per un conto collegato automaticamente tipo e saldo non sono modificabili", "code": "linked_account_read_only" }` | `type` or `balance` sent for a `source:"auto"` account |
| 500 | `{ "error": "Errore interno", "code": "internal_error" }` | invalid JSON body |

**Side effects**: updates the `accounts` row.

## DELETE /api/accounts/{id}
Route name: `accounts.delete` · Auth: session cookie required · Guards: ownership (404). No demo guard.

Works for both manual and auto accounts.

**Response** `204` — empty body.

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ "error": "Conto non trovato", "code": "account_not_found" }` | account not found / not owned |

**Side effects**
- In one DB transaction: deletes ALL `transactions` of the account (hard delete, including bank-synced ones), then deletes the account. `bank_account_links` rows cascade.
- After the transaction, for each bank connection the account was linked to: if no other account remains linked, `releaseConnectionIfUnused` revokes the requisition on **GoCardless** (`deleteRequisition`) and deletes the `bank_connections` row (frees a connection slot). Never throws; failures are left to a daily cleanup.
- Budgets/categories are untouched. Derived data (liquidity history, analytics) recomputes from remaining data (not verified in this route).

**Mobile notes**
- Destructive and irreversible: deleting an auto account also deletes its whole transaction history. Show a strong confirmation.
- No `transactions` cache invalidation is signalled; after DELETE, refetch accounts, transactions, attention and any dashboards.

## Mobile notes (resource-wide)
- `balance` is a decimal string in responses but a JSON number in requests.
- For `source:"auto"` accounts the balance comes from the bank sync; only `name`, `color`, `icon` are editable.
- Manual transactions cannot be added to auto accounts (see `transactions.md`).
- Every response carries an `x-request-id` header (set by `withRoute`).
