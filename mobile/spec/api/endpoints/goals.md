# Goals (savings goals)

Feature area(s): Obiettivi (goals list, goal editor with sources, priority drag & drop, comparison with the FIRE target of Analitiche). IT-only.
Source: `app/api/goals/**/route.ts`, `lib/goals/*`, `lib/validation/goals.ts`, `lib/db/schema/goals.ts`, `lib/analitiche/snapshot.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | /api/goals | Full goals view (plan, sources, free balances, FIRE comparison) | session | DE -> 403; `maxDuration = 30` (heavy) |
| POST | /api/goals | Create goal (+ sources) at a priority position | session | DE -> 403; max 20 goals |
| PATCH | /api/goals/{id} | Partial update / replace sources / mark achieved or reopen | session | DE -> 403 |
| DELETE | /api/goals/{id} | Delete goal + sources, compact priorities | session | DE -> 403 |
| POST | /api/goals/reorder | Set full priority order | session | DE -> 403 |

Country gate: blocked for `productCountry = "DE"` by the proxy (`/api/goals` prefix) and by `withCountryGuard` -> `403 { code: "country_feature_unavailable", error: "<localized>" }`.
Note: here the guard wraps **outside** `withRoute` (`withCountryGuard(withRoute(...))`), so 401/403 produced by the guard are not instrumented and do not carry an `x-request-id` header.

No `rejectIfDemoActive`, no jobs, no cache revalidation. Metrics: `recordGoalAction(action, kind)` Prometheus counter (`created|updated|achieved|reopened|deleted|reordered`), not product analytics.

Constants (`lib/goals/constants.ts`): `GOAL_KINDS = ["emergenza","viaggio","casa","acquisto","altro"]`; `KEPT_GOAL_KINDS = ["emergenza"]` (money stays in net worth when achieved); `MAX_GOALS = 20`; `MAX_GOAL_SOURCES = 12`; `EMERGENCY_MONTH_CHOICES = [3,6,12]`, default 6; `OVERVIEW_GOALS = 3`; `GOAL_DEADLINE_LEAD_DAYS = 30`; `GOAL_HORIZON_MONTHS = 600`.

Shared validators (`lib/validation/goals.ts`):
- `name`: trim, 1..80 ("Dai un nome all'obiettivo", "Il nome è troppo lungo").
- `money`: finite number 0..100,000,000 ("L'importo non può essere negativo", "L'importo è troppo alto").
- `targetMonth`: string matching `/^\d{4}-\d{2}(-\d{2})?$/` ("Data non valida"); **normalized to the first day of the month** (`"2027-06"` or `"2027-06-15"` -> `"2027-06-01"`).
- `GoalSourceInput`: `{ accountId?: uuid | null; instrumentId?: uuid | null; amount: number (>0, "Indica quanto assegnare") }` with exactly one of `accountId`/`instrumentId` set ("Scegli un conto o un titolo"). Array max 12.

---

## GET /api/goals
Route name: `goals.list` · Auth: session · Guards: country

Built by `loadGoalsView(userId)` = `loadAnalyticsSnapshot` (same data & assumptions as Analitiche) + goal rows -> `buildGoalsView`. All amounts are JSON **numbers**.

**Response** `200`
```ts
interface GoalsView {
  currency: string;              // e.g. "EUR"
  todayKey: string;              // server "today" "YYYY-MM-DD"; plan dates start here
  capacity: number | null;       // average monthly savings (Analitiche savings/12); null if unknown
  requested: number;             // sum of monthly quotas of open goals
  allocated: number;             // sum actually funded
  gap: number;                   // monthly shortfall (0 if enough)
  goals: GoalView[];             // ordered by priority asc, then createdAt asc
  fire: {                        // Analitiche FIRE target as "last goal"; null if spending or savings unknown
    target: number; wealth: number;
    progress: number;            // wealth/target (not clamped)
    baseYear: number | null;     // FIRE year without goals; null beyond horizon
    withGoalsYear: number | null;
  } | null;
  sources: FreeSource[];         // free (unassigned) part of each account and position
  essentialMonthly: number | null; // monthly average of the last 12 months of real expenses (web #382) — basis for the emergency fund proposal
  essentialBasis: "dovute" | "tutte" | null; // dovute = Dovute+Saltuarie groups; tutte = every expense (over 25% uncategorised)
  debtsTotal: number;
}

interface GoalView {
  id: string;
  name: string;
  kind: "emergenza" | "viaggio" | "casa" | "acquisto" | "altro";
  target: number;
  targetDate: string | null;     // "YYYY-MM-01"
  monthly: number;               // user-chosen monthly quota
  priority: number;              // 0-based
  achievedAt: string | null;     // ISO-8601 timestamp
  createdAt: string;             // ISO-8601 timestamp
  sources: GoalSourceView[];
  // from GoalPlanRow:
  current: number;               // sum of sources[].counted
  progress: number;              // current/target in [0,1]
  remaining: number;
  funded: number;                // monthly amount actually received after higher-priority goals
  required: number | null;       // monthly quota needed to hit targetDate (null without date or if achieved)
  etaMonth: string | null;       // "YYYY-MM" at `funded` pace, no growth; null if stalled or achieved
  monthsToGo: number | null;
  status: "raggiunto" | "in_linea" | "in_ritardo" | "senza_data" | "fermo";
  fireShiftMonths: number | null;// months this goal delays FIRE (positive = later)
}

interface GoalSourceView {
  id: string;                    // goal_sources row id
  kind: "account" | "instrument";
  refId: string;                 // account id or instrument id
  name: string;                  // "" if account/position no longer exists
  amount: number;                // assigned by the user
  counted: number;               // what counts today: capped by remaining balance/value (higher-priority goals take first), net of estimated sale tax
  tax: number;                   // estimated tax on selling (0 for accounts)
  total: number;                 // account balance or position value
  short: boolean;                // true if capped below `amount`
  accountColor: string | null;   // account avatar colour (accounts only; web #382)
  accountIcon: string | null;    // account avatar icon (accounts only)
  instrumentType: string | null; // etf|azione|… (instruments only), for the instrument icon
}

interface FreeSource {
  kind: "account" | "instrument";
  id: string; name: string;
  total: number;
  free: number;                  // not yet taken by any goal
  taxPerEuro: number;            // instruments only: (unrealizedGain/value)*taxRate; 0 for accounts
  accountColor: string | null; accountIcon: string | null; instrumentType: string | null; // icons (web #382)
}
```
```json
{ "currency": "EUR", "todayKey": "2026-10-18", "capacity": 850, "requested": 600, "allocated": 600, "gap": 0,
  "goals": [ { "id": "g1…", "name": "Fondo emergenza", "kind": "emergenza", "target": 12000, "targetDate": "2027-06-01",
    "monthly": 400, "priority": 0, "achievedAt": null, "createdAt": "2026-01-10T09:12:00.000Z",
    "sources": [ { "id": "s1…", "kind": "account", "refId": "a1…", "name": "Conto deposito", "amount": 8000, "counted": 8000, "tax": 0, "total": 9500, "short": false } ],
    "current": 8000, "progress": 0.6667, "remaining": 4000, "funded": 400, "required": 500, "etaMonth": "2027-08",
    "monthsToGo": 10, "status": "in_ritardo", "fireShiftMonths": 3 } ],
  "fire": { "target": 750000, "wealth": 120000, "progress": 0.16, "baseYear": 2048, "withGoalsYear": 2049 },
  "sources": [ { "kind": "account", "id": "a1…", "name": "Conto deposito", "total": 9500, "free": 1500, "taxPerEuro": 0 } ],
  "essentialMonthly": 1600, "debtsTotal": 0 }
```

**Errors:** 401 empty; 403 country.
**Mobile notes:** expensive call (loads the whole analytics snapshot); cache on the client and refetch after mutations only.

---

## POST /api/goals
Route name: `goals.create` · Auth: session · Guards: country

**Request body** (`application/json`)
```ts
interface CreateGoal {
  name: string;                         // trim 1..80
  kind: "emergenza" | "viaggio" | "casa" | "acquisto" | "altro";
  targetAmount: number;                 // >0, <=1e8 ("Indica quanto vuoi mettere da parte")
  targetDate?: string | null;           // "YYYY-MM" or "YYYY-MM-DD", stored as first of month
  monthlyAmount?: number;               // 0..1e8, default 0
  priority?: number;                    // int 0..100; clamped to current goal count; default = end of list
  sources?: GoalSourceInput[];          // default [], max 12
}
```
Goals at or after `priority` are shifted down by one.

**Response** `201` `{ "id": "<uuid>" }`

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "<first zod issue>" }` | invalid body |
| 409 | `{ error: "Puoi avere al massimo 20 obiettivi" }` | already 20 goals |
| 404 | `{ error: "Ogni conto o titolo può comparire una volta sola" }` | duplicate account/instrument in sources (note: 404, not 400) |
| 404 | `{ error: "Conto non trovato" }` | account not owned |
| 404 | `{ error: "Titolo non trovato" }` | instrument with no investment transaction of the user |
| 401 / 403 | | |

**Side effects:** transaction: insert `goals` (amounts `toFixed(2)`), renumber priorities, insert `goal_sources`. Real balances are never moved (sources are earmarks only).

---

## PATCH /api/goals/{id}
Route name: `goals.update` · Auth: session · Guards: country

**Request body** — all fields optional, at least one required ("Niente da aggiornare"):
```ts
interface UpdateGoal {
  name?: string;
  kind?: GoalKind;
  targetAmount?: number;        // >0
  targetDate?: string | null;   // null clears the date
  monthlyAmount?: number;       // >=0
  sources?: GoalSourceInput[];  // REPLACES all sources of the goal
  achieved?: boolean;           // true => achievedAt = existing or now(); false => achievedAt = null (reopen)
}
```
**Response** `200` `{ "id": "<uuid>" }`

**Errors**
| Status | Body | When |
|---|---|---|
| 404 | **empty body** | goal missing / not owned (checked before body parsing) |
| 400 | `{ error }` | zod |
| 404 | `{ error: "<source error>" }` | same source errors as POST |
| 401 / 403 | | |

**Side effects:** transaction: update `goals` (`updatedAt = now()`), optionally replace `goal_sources`. Metric/log `goals.goal.achieved` / `reopened` / `updated`.

---

## DELETE /api/goals/{id}
Route name: `goals.delete` · Auth: session · Guards: country

**Response** `204` empty.
**Errors:** `404` empty body; 401; 403.
**Side effects:** transaction: delete goal (sources cascade, unverified via FK — sources are tied to `goalId`), recompact remaining priorities to 0..n-1.

---

## POST /api/goals/reorder
Route name: `goals.reorder` · Auth: session · Guards: country

**Request body**
```ts
{ ids: string[] } // uuids, 1..100; must be EXACTLY the set of all the user's goal ids, no duplicates, in the new order
```
**Response** `200` `{ "ok": true }`

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error }` | zod |
| 409 | `{ error: "L'elenco degli obiettivi non è aggiornato: ricarica la pagina" }` | ids set differs from stored goals (stale client) |
| 401 / 403 | | |

**Side effects:** transaction: `priority = index` for each id.
**Mobile notes:** on 409 refetch `GET /api/goals` and reapply.

## Cross-cutting observations
- Goal amounts are JSON **numbers** in responses (converted via `Number()`).
- 404 responses for a missing goal on PATCH/DELETE have an **empty body**; source-ownership failures are 404 with `{ error }` (even for the "duplicate source" validation case).
- Limit violations use **409** (max goals, stale reorder) rather than 400.
- `withCountryGuard` wraps outside `withRoute` here (inverse of pension), so guard responses lack `x-request-id`.
