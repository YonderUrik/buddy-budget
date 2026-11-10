# GoCardless (bank connections & sync)

Feature area(s): Liquidity > Accounts ("Connect your bank" flow, "Accounts found" selection page `/conti/collega/{connectionId}`, "Reconnect"/renew badges, manual "Sync now" button); global sync progress panel (via `/api/sync-jobs`)
Source: `app/api/gocardless/**/route.ts`, `lib/gocardless/*` (client, capacity, capacity-store, sync, sync-eligibility, connection-health, redirect, complete, return-messages), `lib/validation/gocardless.ts`, `lib/views/schemas.ts` (`bankConnection*Schema`), `app/banca/ritorno/page.tsx`, `lib/queries/gocardless.ts`, `components/domain/accounts/connect-bank-flow.tsx`, `app/(app)/conti/collega/[connectionId]/page.tsx`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | `/api/gocardless/institutions?country=XX` | List banks in a country (GoCardless passthrough) | session | external API |
| GET | `/api/gocardless/capacity` | Can the user connect a new bank? Which banks can be renewed | session | — |
| GET | `/api/gocardless/connections` | Status of every linked account (one row per account link) | session | — |
| POST | `/api/gocardless/connections` | Start a bank connection → returns GoCardless consent `link` + `connectionId`; `client: "native"` for the apps | session | **demo-guard** (409 `demo_active`); capacity-limited |
| GET | `/api/gocardless/callback?ref=…` | **Web** browser redirect target after bank consent | session (cookie in the browser) | returns **302 redirects**, never JSON |
| GET | `/api/gocardless/callback/native?ref=…` | **Native** redirect target after bank consent (R6) | **public** (no session) | 302 to `buddybudget://bank/return?…`; no state change |
| POST | `/api/gocardless/connections/{id}/complete` | **Native** (any client): check the consent, mark `linked`, return the accounts to select (R6) | session (bearer) | external API; idempotent |
| GET | `/api/gocardless/connections/{id}/accounts` | External accounts found after consent + existing auto accounts | session | external API |
| POST | `/api/gocardless/connections/{id}/finalize` | Create/re-link accounts and start initial import | session | **job** → `201 { jobId }`, poll `/api/sync-jobs` |
| POST | `/api/gocardless/accounts/{accountId}/sync` | Manual sync of one linked account | session | **job** → `202 { jobId }`; eligibility 4/day + 4h gap |

None is country-gated (DE users can connect banks). Only `POST /api/gocardless/connections` is demo-guarded.

> **R6 status (2026-10-18):** implemented on branch `feat/mobile-api-foundations` of `buddy-budget` (commit `f4895875`,
> not merged). Native apps link banks without any browser cookie, see [Native connection flow](#native-connection-flow-r6).
> Verified with route tests (GoCardless mocked) and against a local dev server for everything except a real consent: the
> local server has no GoCardless credentials, so the sandbox bank (`SANDBOXFINANCE_SFIN0000`) was **not** run end to end.
> Fixtures: [`../fixtures/gocardless-native-flow.json`](../fixtures/gocardless-native-flow.json).

## Native connection flow (R6)

Everything with `Authorization: Bearer <token>`, except the browser leg. Same capacity limits, demo guard and
consent-attempt counting as the web.

1. Capacity and institutions as on the web (steps 1–2 below).
2. `POST /api/gocardless/connections` with `"client": "native"` (`"ios"` / `"android"` are accepted as aliases):
   ```json
   { "institutionId": "SANDBOXFINANCE_SFIN0000", "institutionName": "Sandbox Finance", "transactionTotalDays": 90, "client": "native" }
   ```
   → `200`
   ```json
   { "link": "https://ob.gocardless.com/ob-psd2/start/…", "connectionId": "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b", "client": "native" }
   ```
   Keep `connectionId`: it is the requisition `reference` (tied to this user server-side) and comes back as `ref`.
   The requisition's redirect is `{APP_URL}/api/gocardless/callback/native`.
3. Open `link` in an auth browser session: iOS `ASWebAuthenticationSession(url:, callbackURLScheme: "buddybudget")`,
   Android Custom Tabs + an intent filter for `buddybudget://bank/return`. The user consents at the bank (some banks hand
   off to their own app and come back to the browser).
4. GoCardless sends the browser to `{APP_URL}/api/gocardless/callback/native?ref=<connectionId>[&error=<code>&details=…]`.
   That route is **public and side-effect free** (no session, no DB, no GoCardless call) and answers
   `302 Location: buddybudget://bank/return?ref=<connectionId>&status=<status>[&error=<code>]`:

   | `status` | When | App action |
   |---|---|---|
   | `returned` | no `error` from GoCardless | call `complete` (step 5) |
   | `cancelled` | `error=UserCancelledSession` | show "cancelled", optionally still call `complete` (it answers 409/422) |
   | `failed` | any other GoCardless `error` (code passed on as `error`, sanitized to `[A-Za-z0-9_.-]{1,64}`, else `unknown`) | call `complete` to get the definitive state, show a retry |
   | `invalid_ref` | `ref` missing or not a uuid (no `ref` in the app URL) | show a generic error; no connection to complete |

   `status` is informational only — never trust it as the outcome. If the user closes the browser without a callback,
   call `complete` anyway with the `connectionId` from step 2 (answers `409 bank_consent_pending` if not finished).
5. `POST /api/gocardless/connections/{connectionId}/complete` (no body) → `200` with the accounts to select:
   ```json
   {
     "connectionId": "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b",
     "status": "linked",
     "institutionId": "SANDBOXFINANCE_SFIN0000",
     "institutionName": "Sandbox Finance",
     "consentExpiresAt": "2027-01-16T18:30:00.000Z",
     "externalAccounts": [
       { "externalAccountId": "8d1e5a3c-…", "details": { "iban": "IT60X0542811101000000123456", "name": "Conto principale" } }
     ],
     "existingAutoAccounts": [{ "id": "1d7e4c2b-…", "name": "Conto corrente" }]
   }
   ```
   `externalAccounts` / `existingAutoAccounts` are exactly the `GET …/accounts` payload, so no extra call is needed.
   Errors: `409 bank_consent_pending` (+ `requisitionStatus`), `422 bank_consent_failed` (+ `requisitionStatus`),
   `404 bank_connection_not_found`, `502 bank_unavailable`, `401` empty — see [the endpoint](#post-apigocardlessconnectionsidcomplete).
6. `POST /api/gocardless/connections/{connectionId}/finalize` with the user's selection (unchanged, see below) →
   `201 { jobId }`; poll `GET /api/sync-jobs`.

HTTPS fallback page: `{APP_URL}/banca/ritorno?ref=<id>&status=<status>[&error=<code>]` (public, localized, `noindex`)
shows "Torna a BuddyBudget" with an "Apri l'app" button to the same `buddybudget://bank/return?…` address and tries to
open it on load. The native callback does **not** use it yet (it 302s straight to the custom scheme, which both
`ASWebAuthenticationSession` and Custom Tabs follow). It is the planned target for Universal Links / App Links once
the apps ship `apple-app-site-association` / `assetlinks.json` (auth.md N4); until then it is a manual fallback.

Pending native connections stay `status: "pending"` until `complete` runs. The maintenance cron treats a pending
connection with no accounts as abandoned after **3 days**, but first asks GoCardless: if the requisition is `LN` it
waits a further 7-day orphan grace. So an app that crashes after consent can still call `complete` (and `finalize`)
within ~10 days. The cron recognizes native requisitions as this app's own (same origin + callback path).

## End-to-end connection flow (web today)

1. `GET /api/gocardless/capacity` → if `canConnectNew` is false, show `CAPACITY_BLOCK_MESSAGES[reason]` and offer manual account / file import. Banks in `renewableInstitutionIds` can still be "renewed".
2. User picks a country (web options: `IT, DE, FR, ES, GB`; default = user's `productCountry`) → `GET /api/gocardless/institutions?country=IT`; client-side search by name.
3. `POST /api/gocardless/connections { institutionId, institutionName, transactionTotalDays: Number(institution.transaction_total_days) }` → `{ link }`. Server creates a `bank_connections` row (`status: "pending"`), an End User Agreement (90 days access, scopes balances/details/transactions) and a Requisition with
   - `redirect = getAppUrl() + "/api/gocardless/callback"` where `getAppUrl()` = env **`APP_URL`** with trailing slashes stripped (NOT `BETTER_AUTH_URL`; that one is only used by better-auth),
   - `reference = bank_connections.id` (uuid),
   - `user_language` = user's language upper-cased (`IT|EN|DE`).
4. Web does `window.location.href = link` (full navigation to the bank via GoCardless).
5. After consent, GoCardless redirects the browser to `{APP_URL}/api/gocardless/callback?ref={bank_connections.id}` (GoCardless appends `ref=<reference>`; any extra params such as `error`/`details` are ignored by the route).
6. Callback (see below) checks the requisition and 302-redirects the browser to `{APP_URL}/conti/collega/{connectionId}` on success, or `{APP_URL}/liquidita/conti?bankError=<code>` on failure.
7. Page `/conti/collega/[connectionId]` (client component): `GET /api/gocardless/connections/{id}/accounts`, the user ticks accounts and, for each, chooses "Create new account" or "Re-link to <existing auto account>"; then `POST …/finalize` with
   - new: `{ externalAccountId, name: details.name ?? details.iban ?? "Conto collegato", type: "Conto corrente", mode: "new" }`
   - existing: `{ externalAccountId, name: details.name ?? "Conto collegato", type: "Conto corrente", mode: "existing", existingAccountId }`
   Empty selection is blocked client-side ("Seleziona almeno un conto da importare"). On success web navigates to `/liquidita/conti`, invalidates accounts/connections/capacity/sync-jobs queries and the global panel polls `/api/sync-jobs`.
   Empty `externalAccounts` → page shows "La banca non ha condiviso nessun conto…".

---

## GET /api/gocardless/institutions
Route name: `gocardless.institutions.list` · Auth: session cookie required

**Query params**
| Name | Type | Required | Constraints |
|---|---|---|---|
| `country` | string | yes | `^[A-Z]{2}$` (ISO 3166-1 alpha-2, upper-case) |

**Response** `200` — GoCardless `Institution[]` passthrough (no caching headers set; unverified whether all GoCardless fields are passed — the route returns the raw GoCardless array, so additional fields like `bic`, `countries`, `max_access_valid_for_days` may be present; the typed fields are below).
```ts
interface Institution {
  id: string;                      // e.g. "FINECO_FEBIITM2XXX"
  name: string;
  transaction_total_days: string;  // NUMBER AS STRING, e.g. "730"
  logo?: string;                   // absolute URL to GoCardless CDN
}
```
**Errors**: `400 { error: "Parametro country obbligatorio" }`, `400 { error: "Formato country non valido" }`, `502 { error: "Impossibile recuperare gli istituti bancari" }`, `401` empty.

**Side effects**: GoCardless API call (application token cached in `gocardless_token`).

## GET /api/gocardless/capacity
Route name: `gocardless.capacity.get` · Auth: session cookie required

**Response** `200`
```ts
interface CapacityStatus {
  canConnectNew: boolean;
  reason: "user_limit" | "user_attempts" | "global_limit" | "provider_limit" | null;
  renewableInstitutionIds: string[];   // institutions with at least one linked account (renewal allowed)
}
```
Limits (env, defaults): per user `1` bank (`GOCARDLESS_MAX_CONNECTIONS_PER_USER`), `3` consent attempts per 31 days (`GOCARDLESS_MAX_ATTEMPTS_PER_USER`), global `40` (`GOCARDLESS_MAX_CONNECTIONS`), provider `50` (`GOCARDLESS_PROVIDER_LIMIT`). No global numbers are exposed.

User-facing messages (`CAPACITY_BLOCK_MESSAGES`, Italian; mobile must hard-code/localize):
- `user_limit`: "Per ora puoi collegare una sola banca. Gli altri conti puoi tenerli a mano o importarli da un file."
- `user_attempts`: "Hai avviato troppi collegamenti questo mese. Riprova più avanti, oppure tieni il conto a mano o importa un file."
- `global_limit` / `provider_limit`: "I collegamenti automatici sono al completo: stiamo aggiungendo posti. Intanto puoi tenere il conto a mano o importare un file."

## GET /api/gocardless/connections
Route name: `gocardless.connections.list` · Auth: session cookie required

**Response** `200` — one entry per **linked account** (`bank_account_links` ⋈ `bank_connections`); connections with no linked account (e.g. pending) are not listed. No ordering guaranteed.
```ts
interface BankConnectionStatus {
  accountId: string;          // our accounts.id
  connectionId: string;       // bank_connections.id (several accounts may share it)
  institutionName: string;
  status: "pending" | "linked" | "expired" | "error";
  consentExpiresAt: string | null;  // ISO
  lastSyncedAt: string | null;      // ISO
  eligible: boolean;                // manual sync allowed now
  nextEligibleAt: string | null;    // ISO, null when eligible
  syncsRemainingToday: number;      // 0..4 (rolling 24h window)
}
```
```json
[{ "accountId": "1d7e…", "connectionId": "a3b9…", "institutionName": "Fineco", "status": "linked",
   "consentExpiresAt": "2027-01-10T08:00:00.000Z", "lastSyncedAt": "2026-10-18T06:00:00.000Z",
   "eligible": false, "nextEligibleAt": "2026-10-18T10:00:00.000Z", "syncsRemainingToday": 2 }]
```
Consent validity is `CONSENT_VALID_DAYS = 90`; web warns `CONSENT_EXPIRY_WARNING_DAYS = 7` days before expiry (computed client-side from `consentExpiresAt`). `status: "expired"` → show "Reconnect" (= start a new connection for the same institution: a renewal).

## POST /api/gocardless/connections
Route name: `gocardless.connections.create` · Auth: session cookie required · Guards: `rejectIfDemoActive`

**Request body** (`createConnectionSchema`)
```ts
interface CreateConnection {
  institutionId: string;        // trimmed, min 1
  institutionName: string;      // trimmed, min 1
  transactionTotalDays: number; // int > 0 — pass Number(institution.transaction_total_days); used as max_historical_days
  client?: "web" | "native" | "ios" | "android"; // R6; default "web". ios/android = native
}
```

**Response** `200`
```ts
interface ConnectionStarted {
  link: string;          // GoCardless consent URL
  connectionId: string;  // bank_connections.id = requisition reference = `ref` on return (added by R6, also for web)
  client: "web" | "native";
}
```
`client` decides the requisition redirect: `web` → `{APP_URL}/api/gocardless/callback` (cookie), `native` →
`{APP_URL}/api/gocardless/callback/native` (public).

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 409 | `{ error, code: "demo_active" }` | sample data active |
| 400 | `{ error: <first zod issue>, code: "validation_failed", field }` | validation (also invalid JSON, `field: null`; was a 500 before R6) and unknown `client` |
| 409 | `{ error: CAPACITY_BLOCK_MESSAGES[reason], code: "bank_capacity_reached", reason }` | capacity reached (`user_limit` / `user_attempts` / `global_limit` / `provider_limit`) |
| 409 | `{ error: …provider_limit msg, code: "bank_capacity_reached", reason: "provider_limit" }` | GoCardless replied 402 |
| 502 | `{ error: "Impossibile avviare il collegamento con la banca", code: "bank_unavailable" }` | other GoCardless failure |

**Side effects**: inserts `bank_connections` (`pending`) and a `bank_connection_attempts` row under a global advisory lock; GoCardless agreement + requisition; sets `requisitionId` and a provisional `consentExpiresAt` (now + 90 d). On failure sets connection `status: "error"` (the attempt still counts). Metrics `recordGoCardlessConnect`; log `gocardless.connection.started` carries `kind: "web" | "native"`. Web client tracks `bank_connect_started`.

## GET /api/gocardless/callback
Route name: `gocardless.callback` · Auth: session cookie of the BROWSER that returns from the bank · Response: always a `302` redirect (no JSON)

**Query params**: `ref` (string; the `bank_connections.id` passed as requisition `reference`).

**Behaviour** (all redirects are absolute URLs built from `APP_URL`):
| Condition | Redirect `Location` |
|---|---|
| `ref` missing | `{APP_URL}/liquidita/conti?bankError=missing_ref` |
| no session | `{APP_URL}/login` — **unreachable in practice**: `/api/gocardless/*` is not a public prefix, so the proxy answers `401` with empty body first |
| connection not found for this user, or no `requisitionId` | `{APP_URL}/liquidita/conti?bankError=not_found` |
| requisition status ≠ `"LN"` (linked) | sets connection `status: "error"`; → `{APP_URL}/liquidita/conti?bankError=consent_failed` |
| success | sets `status: "linked"`, `consentExpiresAt = now + 90 d`, `updatedAt`; → `{APP_URL}/conti/collega/{connectionId}` |
| exception (GoCardless down) | `{APP_URL}/liquidita/conti?bankError=gocardless_unavailable` |

A malformed `ref` now reads as `not_found` (it used to throw → `gocardless_unavailable`). Since R6 the web shows the
`bankError` as an error toast on `/liquidita/conti` and removes it from the URL (`missing_ref`/`not_found`: "Non abbiamo
trovato il collegamento con la banca. Riprova dall'inizio."; `consent_failed`: "La banca non ha confermato il consenso:
il collegamento non è stato completato."; `gocardless_unavailable`: "Il servizio di collegamento bancario non risponde.
Riprova tra poco."). Before, no component read it.
Proxy rules still apply: deactivated account → 403 empty; outdated legal acceptance → 403 empty.

**Mobile notes**: native apps don't use this route. They pass `client: "native"` on create and use
[`/api/gocardless/callback/native`](#get-apigocardlesscallbacknative) + [`complete`](#post-apigocardlessconnectionsidcomplete)
(R6, see [Native connection flow](#native-connection-flow-r6)). If the user abandons the consent, the connection stays
`pending` (cleanup cron handles it) and the attempt still counts against `user_attempts`.

## GET /api/gocardless/callback/native
Route name: `gocardless.callback.native` · Auth: **none** (public in `proxy.ts`) · Response: always `302`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`

**Query params** (set by GoCardless): `ref` (the `connectionId`), optionally `error` (e.g. `UserCancelledSession`) and `details` (ignored).

**Behaviour**: no session, no database read, no GoCardless call, no state change. `Location` is always
`buddybudget://bank/return?` + `ref` (lower-cased uuid; omitted if missing/not a uuid) + `status` + optional `error`:

| Input | `Location` |
|---|---|
| `?ref=<uuid>` | `buddybudget://bank/return?ref=<uuid>&status=returned` |
| `?ref=<uuid>&error=UserCancelledSession&details=…` | `…?ref=<uuid>&status=cancelled&error=UserCancelledSession` |
| `?ref=<uuid>&error=InstitutionTechnicalError` | `…?ref=<uuid>&status=failed&error=InstitutionTechnicalError` |
| `?ref=<uuid>&error=<not an identifier>` | `…?ref=<uuid>&status=failed&error=unknown` |
| no `ref`, or `ref` not a uuid | `buddybudget://bank/return?status=invalid_ref` |

Security: a forged address only opens the app with an id; `complete` checks ownership with the bearer token, so a
foreign or invented `ref` answers 404. Log event `gocardless.callback.native_returned` (`outcome` = status, `reason` =
error code; the ref is never logged).

## POST /api/gocardless/connections/{id}/complete
Route name: `gocardless.connections.complete` · Auth: session required (bearer for the apps; the web may use it too) · Body: none

**Path params**: `id` — the `connectionId` (`ref`). Malformed ids answer 404 (no 500).

**Behaviour**: loads the user's connection (must have a requisition), asks GoCardless for the requisition, then:
- `LN` → sets `status: "linked"`, `consentExpiresAt = now + 90 d`, `updatedAt` (only the first time: a retry on an
  already linked connection keeps the original expiry) → `200` with the accounts (one GoCardless details call per account);
- `CR` / `GC` / `UA` / `SA` / `GA` (still in the consent flow) → `409 bank_consent_pending`, **no change** (call again later
  or restart);
- anything else (`RJ` rejected, `EX` expired, `SU` suspended…) → sets `status: "error"` if it was `pending`/`error`
  (a `linked` connection is never downgraded) → `422 bank_consent_failed`.

**Response** `200`
```ts
interface ConnectionCompleted {
  connectionId: string;
  status: "linked";
  institutionId: string;
  institutionName: string;
  consentExpiresAt: string | null;   // ISO
  externalAccounts: Array<{ externalAccountId: string; details: { iban?: string; name?: string; product?: string } }>;
  existingAutoAccounts: Array<{ id: string; name: string }>;  // re-link candidates (renewal)
}
```
Example: see [Native connection flow](#native-connection-flow-r6) step 5 and `complete` in the fixture.

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ error: "Collegamento con la banca non trovato", code: "bank_connection_not_found" }` | unknown / malformed id, another user's connection, no requisition (create failed) |
| 409 | `{ error: "Il consenso con la banca non è ancora completo", code: "bank_consent_pending", requisitionStatus: "UA" }` | consent not finished |
| 422 | `{ error: "La banca non ha confermato il consenso", code: "bank_consent_failed", requisitionStatus: "RJ" }` | consent rejected/expired |
| 502 | `{ error: "Banca non raggiungibile, riprova tra poco", code: "bank_unavailable" }` | GoCardless unreachable (requisition or details call) |

`error` is translated to the user's language by the server; switch on `code`. Logs: `gocardless.connection.completed`
(`count` = accounts), `…complete_pending` / `…complete_failed` (`reason` = requisition status), `…complete_unavailable`.

## Page /banca/ritorno
Public HTML page (no API), see [Native connection flow](#native-connection-flow-r6). Query `ref`, `status`, `error` as in
the app URL; an unknown `status` reads as `returned`, a bad `ref` as `invalid_ref`. Never changes state.

## GET /api/gocardless/connections/{id}/accounts
Route name: `gocardless.connections.accounts` · Auth: session cookie required

**Path params**: `id` — `bank_connections.id` (uuid). A malformed uuid answers `404` (since R6; it used to be a 500).

**Response** `200`
```ts
interface ConnectionAccountsResponse {
  externalAccounts: Array<{
    externalAccountId: string;      // GoCardless account id
    details: { iban?: string; name?: string; product?: string };  // GoCardless /accounts/{id}/details "account" object (other fields may pass through)
  }>;
  existingAutoAccounts: Array<{ id: string; name: string }>;  // ALL user's accounts with source "auto" (candidates for re-link)
}
```

**Errors**: `404 { code: "not_found" }` (connection not found / not owned / no requisitionId; the generic code is added by `withRoute`); `502 { error: "Impossibile recuperare i conti dalla banca", code: "internal_error" }`; `401` empty. Native apps get the same payload from `complete` and only need this route to re-read the list later.

**Side effects**: GoCardless calls (requisition + one details call per account — counts against GoCardless rate limits).

## POST /api/gocardless/connections/{id}/finalize
Route name: `gocardless.connections.finalize` · Auth: session cookie required · `maxDuration = 300` · **Job**

**Request body** (`finalizeSelectionSchema`)
```ts
interface FinalizeSelection {
  selections: Array<{                 // min 1
    externalAccountId: string;        // trimmed, min 1; must belong to this connection's requisition
    name: string;                     // trimmed, min 1 (account name for "new")
    type: string;                     // trimmed, min 1; FREE TEXT account type (web sends "Conto corrente")
    mode: "new" | "existing";
    existingAccountId?: string;       // uuid; required when mode = "existing"; must be the user's account with source "auto"
  }>;
}
```

**Response** `201 { "jobId": "7c2e…-uuid" }` — then poll `GET /api/sync-jobs` (job `kind: "initial-import"`).

**Errors** (in order)
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | empty | connection not found / not owned |
| 500 | `{ error: "Errore interno" }` | body not valid JSON |
| 400 | `{ error: <first zod issue> }` | validation |
| 400 | `{ error: "Connessione non completata" }` | connection has no requisitionId |
| 502 | `{ error: "Banca non raggiungibile, riprova tra poco" }` | GoCardless requisition fetch failed |
| 400 | `{ error: "Conto non appartenente a questa connessione" }` | externalAccountId not in requisition |
| 400 | `{ error: "existingAccountId richiesto per mode 'existing'" }` | missing id |
| 404 | `{ error: "Conto non trovato" }` | existing account not owned / not auto / link missing |
| 503 | `{ error: "Servizio temporaneamente non disponibile. Riprova tra poco." }` | Redis job store unavailable (before any write) |

**Side effects**: creates the job in Redis; for `new` inserts `accounts` (`source: "auto"`, balance default) + `bank_account_links`; for `existing` moves the existing link to this connection (renewal) and, in `after()`, releases the previous connection if it has no more accounts (`releaseConnectionIfUnused`, deletes requisition). Acquires per-account Redis lock `sync-lock:{accountId}` (TTL 360 s); accounts already locked appear in the job with `phase: "error"`, `errorReason: "already-running"`. Runs `runSyncJob` in `after()`: balance + transactions download, insert, rule categorization, AI suggestions/auto-apply. Not idempotent: **do not retry on timeout** (a retry duplicates "new" accounts) — check `/api/sync-jobs` and the account list instead. Web client tracks `bank_connect_completed { accounts }`.

## POST /api/gocardless/accounts/{accountId}/sync
Route name: `gocardless.accounts.sync` · Auth: session cookie required · `maxDuration = 300` · **Job**

**Path params**: `accountId` — our `accounts.id` (must be linked to a `linked` connection of the user).

**Request body**: none.

**Response** `202 { "jobId": "uuid" }` — job `kind: "manual-sync"` with one account (already `queued`).

**Errors** (bodies use a `status` discriminator, not `error`, except 404)
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 404 | `{ error: "Conto non trovato o non collegato" }` | not found / not owned / connection not `linked` |
| 429 | `{ status: "not-eligible", nextEligibleAt: string \| null, syncsRemainingToday: number }` | > 4 syncs in rolling 24 h or < 4 h since last sync (budget shared with the automatic cron sync) |
| 503 | `{ status: "unavailable" }` | Redis lock/job store failure |
| 409 | `{ status: "already-running" }` | per-account lock held (sync in progress elsewhere) |

Web maps these via `buildSyncErrorMessage` (Italian): not-eligible → "Hai raggiunto il limite giornaliero di sync. Prossimo disponibile alle HH:MM." (or "Sync non disponibile al momento. Riprova più tardi." if `nextEligibleAt` null); already-running → "Sincronizzazione già in corso per questo conto."; unavailable → "Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco."; other → "Impossibile completare la sincronizzazione. Riprova più tardi.". Final per-account outcomes `limited` / `expired` arrive through the job (messages: "La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi." / "Sessione con la banca scaduta. Riconnetti il conto per sincronizzare.").

**Side effects**: same sync pipeline as finalize. Updates `accounts.balance` (string numeric), inserts `transactions` (dedup on `(accountId, externalId)`), updates `bank_account_links.lastSyncedAt` / `syncTimestamps` (max 4) / `nextSyncEligibleAt`; on GoCardless 401 marks the connection `expired`. Web client tracks `account_sync_manual`.

**Mobile notes**: use `GET /api/gocardless/connections` (`eligible`, `nextEligibleAt`) to enable/disable the button; after `202` start polling `/api/sync-jobs` every ~1 s; on `409 already-running` also refresh `/api/sync-jobs` (a job started elsewhere).

## Cross-cutting observations
- `POST /finalize` uses `await request.json()` without try/catch → invalid JSON yields `500 { error: "Errore interno" }` (from `withRoute`) instead of 400. `POST /connections` answers 400 `validation_failed` since R6.
- Mixed 404 styles: empty body (`connections/{id}/accounts`, `finalize` connection lookup) vs `{ error }`.
- Manual-sync errors use `{ status: "<code>" }` bodies (no `error` field) — a distinct error shape.
- Finalize answers **201**, manual sync **202** for the same `{ jobId }` contract.
- The two callbacks are the only routes here returning redirects; the web callback's `/login` branch is dead code because of the proxy. The native callback is the only public route here.
- No disconnect/delete-connection endpoint here: unlinking happens via `DELETE /api/accounts/{id}` (see accounts.md).
