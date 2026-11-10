# User (account, preferences, lifecycle)

Feature area(s): Onboarding wizard; Settings (Profile, Preferences, Notifications, AI categorization, Sessions/devices, Data & privacy: export / reset / deactivate / delete); "Accept updated Terms" gate screen; "Account deactivated" screen (reactivate)
Source: `app/api/user/**/route.ts`, helpers in `lib/account/*`, `lib/legal/*`, `lib/notifications/*`, `lib/validation/user-settings.ts`, `lib/validation/notifications.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | `/api/user/settings` | Profile + preferences for Settings | session | — |
| PATCH | `/api/user/settings` | Update name / country / language / currency / homePage / hideAmounts | session | — |
| POST | `/api/user/onboarding` | Complete onboarding (currency, locale, legal, categories, notifications, AI consent) | session | — |
| POST | `/api/user/legal-acceptance` | Accept current Terms & Privacy version | session | allowed through the legal gate |
| GET | `/api/user/notifications` | Email notification preferences | session | — |
| PATCH | `/api/user/notifications` | Update email notification preferences | session | — |
| POST | `/api/user/notifications/test` | Send a sample digest email to the account address | session | rate-limited 3/hour (DB-counted) |
| GET | `/api/user/ai-categorization` | AI categorization consent / instructions / auto-apply | session | — |
| PATCH | `/api/user/ai-categorization` | Toggle consent, save instructions, toggle auto-apply | session | auto-apply runs in `after()` (no job id) |
| GET | `/api/user/sessions` | List active sessions (devices) | session | — |
| DELETE | `/api/user/sessions` | Sign out all OTHER sessions | session | — |
| DELETE | `/api/user/sessions/{id}` | Revoke one other session | session | — |
| GET | `/api/user/data-summary` | Counts of user data (before export/reset/delete) | session | — |
| GET | `/api/user/export` | Download ZIP of all user data | session + **recent login** | binary download; allowed through the legal gate |
| POST | `/api/user/reset` | Wipe all financial data, restart onboarding | session + **recent login** | 409 if a bank sync job is running |
| POST | `/api/user/deactivate` | Schedule account deletion (30 days grace) | session + **recent login** | sends email |
| POST | `/api/user/reactivate` | Cancel scheduled deletion | session | the ONLY `/api/*` reachable by a deactivated account |
| DELETE | `/api/user/account` | Delete account immediately and permanently | session + **recent login** | sends email; allowed through the legal gate |

None of these routes call `rejectIfDemoActive` and none are country-gated.

## Shared concepts

### Session helper (`lib/account/route-session.ts`)
All routes here use `sessionOrUnauthorized` (→ `401` empty body) except `/api/user/onboarding`, which calls `auth.api.getSession` directly (same 401 empty).

`readJson(request)` returns `null` on invalid/missing JSON instead of throwing, so malformed JSON usually ends up as a validation 400 (not a 500).

### Recent login ("reauth") rule
Sensitive routes (`export`, `reset`, `deactivate`, `account` DELETE) call `recentLoginRequired(session)`:
the **current session's `createdAt`** must be no older than `RECENT_LOGIN_MAX_AGE_MINUTES = 10` minutes. Otherwise:

```
403 { "error": "Per sicurezza accedi di nuovo prima di continuare.", "code": "reauth_required" }
```

Note: this is the session creation time, not a password check — the client must perform a fresh sign-in (magic link / Google via better-auth, documented in the auth spec) which creates a new session. `GET /api/user/settings` returns `recentLoginUntil` (ISO) so the UI can know in advance whether a reauth will be needed.

Distinguish this 403 from the proxy's gate 403s: `{ "code": "account_deactivated" }` and `{ "code": "legal_acceptance_required", "version": "<LEGAL_VERSION>" }` (branch `feat/mobile-api-foundations`; before it they had an EMPTY body).

### Enums (verbatim)
- `productCountry`: `"IT" | "DE"`; `language`: `"it" | "en" | "de"`. Allowed combinations (`COUNTRY_LANGUAGES`): `IT → it, en`; `DE → en, de`.
- `currency` (`SUPPORTED_CURRENCIES`): `"EUR" | "USD" | "GBP" | "CHF"` (exact, case-sensitive).
- `homePage` (`HOME_PAGE_OPTIONS`, web paths): `"/panoramica" | "/liquidita" | "/liquidita/conti" | "/liquidita/analisi" | "/investimenti"`. Default `"/panoramica"`. Legacy stored values `/conti`, `/movimenti`, `/movimenti/analisi` are mapped on read. Mobile should map these web paths to its own tabs.
- `digestFrequency` (`DIGEST_FREQUENCIES`): `"settimanale" | "mensile"`.
- `LEGAL_VERSION` (`lib/legal/version.ts`): currently `"2026-10-12"` — changes when Terms/Privacy change. The client must send exactly the server's current value: read it from the public `GET /api/legal` ([legal.md](./legal.md)) or `legal.currentVersion` of `GET /api/me/bootstrap` ([me.md](./me.md)) (branch `feat/mobile-api-foundations`).

---

## GET /api/user/settings
Route name: `user.settings.get` · Auth: session cookie required · Guards: none

**Response** `200`
```ts
interface UserSettings {
  name: string;
  email: string;
  image: string | null;
  productCountry: "IT" | "DE";      // resolved: unknown stored value → "IT"
  language: "it" | "en" | "de";     // resolved: invalid combo → "it" (IT) / "en" (DE)
  currency: string;                 // stored user currency (one of SUPPORTED_CURRENCIES in practice)
  homePage: HomePagePath;           // resolved with fallback "/panoramica"
  hideAmounts: boolean;
  legalAcceptedAt: string | null;   // ISO-8601
  legalAcceptedVersion: string | null;
  createdAt: string;                // ISO-8601
  googleLinked: boolean;            // a better-auth "google" account row exists
  recentLoginUntil: string;         // ISO-8601 = session.createdAt + 10 min
}
```
```json
{
  "name": "Mario Rossi", "email": "mario@example.com", "image": null,
  "productCountry": "IT", "language": "it", "currency": "EUR",
  "homePage": "/panoramica", "hideAmounts": false,
  "legalAcceptedAt": "2026-10-13T08:12:00.000Z", "legalAcceptedVersion": "2026-10-12",
  "createdAt": "2025-02-01T10:00:00.000Z", "googleLinked": true,
  "recentLoginUntil": "2026-10-18T09:40:00.000Z"
}
```

**Errors**: `401` empty.

## PATCH /api/user/settings
Route name: `user.settings.update` · Auth: session cookie required · Guards: none

**Request body** (`application/json`, `updateUserSettingsSchema`, `.strict()` — unknown keys rejected; at least one field required)
```ts
interface UpdateUserSettings {
  name?: string;            // trimmed, 1..80 chars ("Il nome non può essere vuoto" / "Massimo 80 caratteri")
  productCountry?: "IT" | "DE";
  language?: "it" | "en" | "de";
  currency?: "EUR" | "USD" | "GBP" | "CHF";   // "Valuta non supportata"
  hideAmounts?: boolean;
  homePage?: HomePagePath;  // "Pagina non valida"
}
```
The resulting (country, language) pair — merging the patch with the current resolved profile — must be a supported combination.

**Response** `204` no body.

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: string }` (first zod issue; `"Nessuna modifica"` if empty object; zod default message for unknown keys) | validation |
| 400 | `{ error: "Unsupported country and language combination", code: "unsupported_locale" }` | e.g. `{ productCountry: "DE" }` while language is `"it"` — send both together |
| 401 | empty | no session |

**Side effects**: updates `user` row (`updatedAt`). Changing `currency` does NOT convert existing amounts. Changing `productCountry` to `DE` immediately activates the country gate on IT-only APIs.

**Mobile notes**: re-fetch settings after PATCH (no body returned). `hideAmounts` is a display preference the client must honour (mask money as `••••`).

---

## POST /api/user/onboarding
Route name: `user.onboarding` · Auth: session cookie required · Guards: none (works for users with `onboardingCompleted = false`; also callable again)

**Request body** (`application/json`; validated manually, not one zod schema)
```ts
interface OnboardingBody {
  currency: "EUR" | "USD" | "GBP" | "CHF";          // required
  legal: {                                          // required (legalAcceptanceSchema)
    version: string;            // must equal LEGAL_VERSION exactly (currently "2026-10-12")
    ageConfirmed: true;
    termsAccepted: true;
    specificClausesAccepted: true;
  };
  productCountry?: "IT" | "DE"; // default: current resolved profile
  language?: "it" | "en" | "de";// default: current resolved profile
  aiCategorization?: boolean;   // consent; saved only if a boolean is sent. true is stored only if the server has OPENROUTER_API_KEY
  notifications?: {             // notificationPreferencesSchema (.strict()); silently ignored if invalid
    digestEnabled: boolean;
    digestFrequency: "settimanale" | "mensile";
    budgetAlertsEnabled: boolean;
    deadlineAlertsEnabled: boolean;
    goalAlertsEnabled?: boolean;
  };
  categories?: Array<{          // categorySetupSchema, max 100; omit if the user didn't change the proposal
    key: string | null;         // max 40 (starter category key, null for user-added)
    name: string;               // max 80
    type: "dovuta" | "voluta" | "futuro" | "saltuaria" | "entrata" | "trasferimento";
    enabled: boolean;
  }>;
}
```

**Response** `200` with EMPTY body (not 204).

**Errors** (checked in this order)
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ error: "Richiesta non valida" }` | body is not valid JSON |
| 400 | `{ error: "Unsupported country and language combination", code: "unsupported_locale" }` | bad country/language pair |
| 400 | `{ error: "Valuta non supportata" }` | currency missing/unsupported |
| 400 | `{ error: "Per continuare accetta Termini e Privacy", code: "legal_acceptance_required" }` | `legal` missing/incomplete/wrong version |

**Side effects**: updates user (`currency`, `productCountry`, `language`, `onboardingCompleted = true`, optionally `aiCategorizationConsentAt`); records legal acceptance (`legalAcceptedAt = now`, `legalAcceptedVersion = LEGAL_VERSION`); upserts notification preferences if valid; applies category setup (errors are logged and swallowed, defaults remain); localizes starter categories to the chosen language.

**Mobile notes**: invalid `notifications`/`categories` do NOT fail the request — validate client-side. Web navigates to the home page afterwards; the proxy stops redirecting to `/onboarding` once `onboardingCompleted` is true. API routes are NOT blocked for users who haven't onboarded (only web pages are redirected), so mobile must itself route to its onboarding flow when `onboardingCompleted` is false (read from the better-auth session user).

---

## POST /api/user/legal-acceptance
Route name: `user.legal_acceptance` · Auth: session cookie required · Guards: reachable even when the legal gate blocks other APIs

**Request body**: same object as `legal` above (`{ version, ageConfirmed: true, termsAccepted: true, specificClausesAccepted: true }`).

**Response** `204`.

**Errors**: `401` empty; `400 { error: "Per continuare accetta Termini e Privacy", code: "legal_acceptance_required" }` for invalid/incomplete body or stale `version`.

**Side effects**: sets `legalAcceptedAt`, `legalAcceptedVersion` on the user.

**Mobile notes**: when any `/api/*` call returns `403 { "code": "legal_acceptance_required", "version": "…" }`, show the "accept updated Terms" screen and call this endpoint with that `version`. Only `/api/user/legal-acceptance`, `/api/user/export`, `/api/user/account` and `/api/me/bootstrap` pass the gate.

---

## GET /api/user/notifications
Route name: `user.notifications.get` · Auth: session cookie required

**Response** `200`
```ts
interface NotificationPreferences {
  digestEnabled: boolean;
  digestFrequency: "settimanale" | "mensile";
  budgetAlertsEnabled: boolean;
  deadlineAlertsEnabled: boolean;
  goalAlertsEnabled: boolean;
}
```
Defaults when never saved: all `false`, `digestFrequency: "mensile"`.
```json
{ "digestEnabled": true, "digestFrequency": "mensile", "budgetAlertsEnabled": false, "deadlineAlertsEnabled": true, "goalAlertsEnabled": false }
```

## PATCH /api/user/notifications
Route name: `user.notifications.update` · Auth: session cookie required

**Request body**: `Partial<NotificationPreferences>`, `.strict()`, at least one key.

**Response** `200` — the full resulting `NotificationPreferences`.

**Errors**: `401` empty; `400 { error }` first zod issue (`"Nessuna preferenza da aggiornare"` for `{}`).

**Side effects**: upsert into `notification_preferences`. These are EMAIL notifications only (there is no push notification support server-side).

## POST /api/user/notifications/test
Route name: `user.notifications.test` · Auth: session cookie required

**Request body**: none required (body is read and ignored).

**Response** `204`.

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 429 | `{ error: "Hai già chiesto alcuni esempi: riprova tra un po'." }` | ≥ 3 test emails in the last hour (`TEST_EMAIL_MAX_PER_HOUR`, counted in `notification_log`) |
| 409 | `{ error: "Nel mese scorso non hai movimenti né investimenti: l'esempio sarebbe vuoto." }` | empty digest for last month |
| 502 | `{ error: "Non siamo riusciti a inviare l'email. Riprova tra poco." }` | Resend failure |

**Side effects**: builds a monthly digest from last completed month (transactions, budgets, investments), sends an email via Resend to the account address with subject prefixed `Esempio · `, honours `hideAmounts` (money masked), inserts a `notification_log` row (kind `test`). Email contains web links (`APP_URL/impostazioni?sezione=notifiche#impostazioni-notifiche`, unsubscribe page `APP_URL/disiscrizione?t=…`).

---

## GET /api/user/ai-categorization
Route name: `user.ai_categorization.get` · Auth: session cookie required

**Response** `200`
```ts
interface AiCategorizationState {
  enabled: boolean;      // consent given (aiCategorizationConsentAt != null)
  instructions: string;  // free text, "" if none
  available: boolean;    // server has OPENROUTER_API_KEY configured
  autoApply: boolean;    // apply "safe" (>= 90%) proposals automatically; works also without AI (rules/past choices)
}
```
```json
{ "enabled": true, "instructions": "Esselunga è sempre Spesa", "available": true, "autoApply": false }
```

## PATCH /api/user/ai-categorization
Route name: `user.ai_categorization.update` · Auth: session cookie required

**Request body** (at least one field)
```ts
interface UpdateAiCategorization {
  enabled?: boolean;
  instructions?: string;  // trimmed, max 2000
  autoApply?: boolean;
}
```

**Response** `200` — same shape as GET (fresh state).

**Errors**: `401` empty; `400 { error: "Dati non validi" }` (fixed message, NOT the zod issue).

**Side effects**: in a transaction: `enabled` sets/clears `aiCategorizationConsentAt`; `instructions` saved and, if changed, all pending (`status = "in_attesa"`) `categorization_suggestions` of the user are deleted; `autoApply` saved. If `autoApply: true`, `autoApplyCategoriesSafely(userId)` runs in `after()` (background, no job id, no polling endpoint — refresh the categorization queue later).

---

## GET /api/user/sessions
Route name: `user.sessions.list` · Auth: session cookie required

**Response** `200` — `UserSessionView[]`, non-expired sessions; current first, then by `lastActiveAt` desc. No token, no IP.
```ts
interface UserSessionView {
  id: string;
  device: string;       // human label derived from User-Agent (lib/account/user-agent.ts)
  browser: string;
  os: string;
  mobile: boolean;
  createdAt: string;    // ISO
  lastActiveAt: string; // ISO (session.updatedAt)
  expiresAt: string;    // ISO
  current: boolean;
}
```
```json
[{ "id": "s_abc", "device": "Chrome su macOS", "browser": "Chrome", "os": "macOS", "mobile": false,
   "createdAt": "2026-10-18T09:30:00.000Z", "lastActiveAt": "2026-10-18T09:35:00.000Z",
   "expiresAt": "2026-11-17T09:30:00.000Z", "current": true }]
```
(`device` label format is whatever `formatDevice` produces — exact wording unverified.)

**Mobile notes**: the native app's User-Agent determines how its sessions are labelled; send a descriptive UA (e.g. `BuddyBudget-iOS/1.0 (iPhone; iOS 18)`) — how the parser renders unknown UAs is unverified.

## DELETE /api/user/sessions
Route name: `user.sessions.revoke_others` · Auth: session cookie required

**Response** `200 { "revoked": number }` — count of other sessions deleted.

## DELETE /api/user/sessions/{id}
Route name: `user.sessions.revoke` · Auth: session cookie required

**Path params**: `id` (string, session id from the list).

**Response** `204`.

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "Per chiudere questa sessione usa Esci." }` | `id` is the current session (use better-auth sign-out instead) |
| 404 | `{ error: "Sessione non trovata" }` | not found or not the user's |

---

## GET /api/user/data-summary
Route name: `user.data_summary` · Auth: session cookie required

**Response** `200` — counts (JSON numbers).
```ts
interface UserDataSummary {
  accounts: number; bankConnections: number; transactions: number; categories: number;
  rules: number; budgets: number; investmentOperations: number; debts: number;
  pensionFunds: number; netWorthDays: number;   // distinct snapshot dates
}
```

---

## GET /api/user/export
Route name: `user.export` · Auth: session cookie required + recent login · Guards: allowed through the legal gate · `maxDuration = 60`

**Response** `200` binary ZIP (synchronous, not a job).
Headers: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="buddybudget-export-YYYY-MM-DD.zip"` (UTC date), `Cache-Control: no-store`.

ZIP contents (fflate, level 6):
- `LEGGIMI.txt` — Italian readme
- `dati-completi.json` — `{ format: "buddybudget-export", version: 1, exportedAt: ISO, ...allData }`
- CSVs: `transazioni.csv`, `conti.csv`, `categorie.csv`, `budget.csv`, `abbonamenti.csv`, `obiettivi.csv`, `regole-categorizzazione.csv`, `investimenti-operazioni.csv`, `investimenti-titoli-seguiti.csv`, `investimenti-avvisi-prezzo.csv`, `debiti.csv`, `debiti-eventi.csv`, `previdenza-fondi.csv`, `previdenza-fotografie.csv`, `patrimonio-netto.csv` (+ personal-import data inside the JSON)

**Errors**: `401` empty; `403 { error, code: "reauth_required" }`.

**Mobile notes**: download to a file and hand it to the share sheet / Storage Access Framework. Can be large; use a streaming download with a generous timeout (server allows 60 s).

---

## POST /api/user/reset
Route name: `user.reset` · Auth: session + recent login · `maxDuration = 60`

**Request body**: `{ "confirmation": "RESETTA" }` (exact `RESET_CONFIRMATION_WORD`, Italian, not localized).

**Response** `204`.

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 403 | `{ error, code: "reauth_required" }` | session older than 10 min |
| 400 | `{ error: "Scrivi RESETTA per confermare." }` | wrong confirmation |
| 409 | `{ error: "C'è una sincronizzazione bancaria in corso: riprova quando è finita." }` | a sync job (Redis) is `running` and not `interrupted` |

**Side effects**: revokes GoCardless requisitions (best effort); deletes all financial data (accounts, transactions, budgets, goals, debts, pension, investments, personal-import formats, rules, net-worth snapshots, user-created instruments …); re-inserts default categories; sets `onboardingCompleted = false`, `currency = "EUR"`, `homePage = "/panoramica"`; clears Redis keys `sync-jobs:{userId}`, `sync-job:{userId}:*`, net-worth fingerprint. Sessions, name, email, login methods remain.

**Mobile notes**: after 204 the user must go through onboarding again.

## POST /api/user/deactivate
Route name: `user.deactivate` · Auth: session + recent login

**Request body**: none.

**Response** `200 { "deletionScheduledAt": "2026-11-17T09:31:00.000Z" }` (now + `DEACTIVATION_GRACE_DAYS = 30`).

**Errors**: `401` empty; `403 reauth_required`; `409 { error: "L'account è già disattivato." }`.

**Side effects**: sets `deletionScheduledAt`; deletes all OTHER sessions (current one stays); sends "deactivated" email (Resend). From now on every `/api/*` except `/api/user/reactivate` (and `/api/auth/*`) returns `403` empty. Cron `account-deletion` purges after the date.

## POST /api/user/reactivate
Route name: `user.reactivate` · Auth: session cookie required · Guards: the only API allowed for deactivated accounts

**Request body**: none. **Response** `204` (also when the account was not deactivated — idempotent).

**Side effects**: `deletionScheduledAt = null`.

**Mobile notes**: on a 403 empty body, check the session user's `deletionScheduledAt` (from better-auth `get-session`) to decide between the "deactivated" screen and the "legal acceptance" screen.

## DELETE /api/user/account
Route name: `user.account.delete` · Auth: session + recent login · Guards: allowed through the legal gate · `maxDuration = 60`

**Request body**: `{ "email": "<account email>" }` — compared trimmed + lowercase with the session email.

**Response** `204`.

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 403 | `{ error, code: "reauth_required" }` | not a recent login |
| 400 | `{ error: "L'email scritta non corrisponde a quella dell'account." }` | email mismatch / missing body |
| 409 | `{ error: "C'è una sincronizzazione bancaria in corso: riprova quando è finita." }` | active sync job |

**Side effects**: revokes GoCardless consents (best effort), deletes all data and the user row (sessions cascade), clears Redis state, sends "deleted" email. The session cookie becomes invalid; any further call returns 401.

**Mobile notes**: after 204 clear local credentials/cookies and caches. Web shows login with `?account=eliminato`.

## Cross-cutting observations
- `/api/user/onboarding` returns `200` with an empty body (not 204, not JSON).
- `/api/user/ai-categorization` PATCH returns a fixed `"Dati non validi"` instead of the first zod issue.
- Several 400s carry a `code` field: `unsupported_locale`, `legal_acceptance_required`; 403 `reauth_required`.
- `LEGAL_VERSION` is now exposed by `GET /api/legal` and `GET /api/me/bootstrap` (branch `feat/mobile-api-foundations`). There is still no API exposing `SUPPORTED_CURRENCIES`, `HOME_PAGE_OPTIONS`, `COUNTRY_LANGUAGES` or the onboarding category proposal: mobile must hard-code them (and will break on a legal version bump until updated) — gap.
- Error messages are Italian hard-coded strings (except `unsupported_locale`, English).
