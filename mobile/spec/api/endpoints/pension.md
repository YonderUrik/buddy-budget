# Pension (supplementary pension funds)

Feature area(s): Pensione (all tabs: funds overview, snapshots history, import, rate simulation). IT-only.
Source: `app/api/pension/**/route.ts`, `lib/pension/*`, `lib/validation/pension.ts`, `lib/db/schema/pension.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | /api/pension | List the user's funds with all snapshots | session | DE -> 403 (proxy + `withCountryGuard`) |
| GET | /api/pension/view | Everything the Pensione tabs compute for one fund (gaps.md G10, branch `feat/mobile-api-foundations`) | session | DE -> 403 |
| POST | /api/pension/funds | Create a fund | session | DE -> 403; max 10 funds |
| PATCH | /api/pension/funds/{id} | Rename / change adhesion date | session | DE -> 403 |
| DELETE | /api/pension/funds/{id} | Delete fund + its snapshots (cascade) | session | DE -> 403 |
| POST | /api/pension/funds/{id}/snapshots | Upsert one snapshot (by date) | session | DE -> 403; max 5000 snapshots/fund |
| DELETE | /api/pension/funds/{id}/snapshots/{snapshotId} | Delete one snapshot | session | DE -> 403 |
| POST | /api/pension/funds/{id}/snapshots/import | Bulk upsert snapshots parsed client-side | session | DE -> 403; max 1000 rows; all-or-nothing |

No route in this resource calls `rejectIfDemoActive`. No background jobs, no `track()` events, no cache revalidation.

Country gate: every handler is wrapped `withRoute(name, withCountryGuard(handler))`. For `productCountry = "DE"` the response is
`403 { "code": "country_feature_unavailable", "error": "<localized: Questa funzione non è ancora disponibile per la Germania.>" }`.
(Additionally `loadUserPension` itself returns `{ funds: [] }` for DE users, but that branch is unreachable through the API.)

Shared limits (`lib/pension/limits.ts`): `PENSION_MAX_FUNDS = 10`, `PENSION_MAX_SNAPSHOTS_PER_FUND = 5000`, `PENSION_IMPORT_MAX_ROWS = 1000`.

Shared validators (`lib/validation/pension.ts`):
- `dateKey`: string matching `/^\d{4}-\d{2}-\d{2}$/` (message "Data non valida").
- `amount`: JSON number, finite, `>= 0`, `<= 100000000` (messages "Importo non valido", "L'importo non può essere negativo", "Importo troppo alto").
- `name`: string, trimmed, length 1..80 ("Il nome è obbligatorio"; max-length uses zod default message).
- `isPlausiblePensionDate(value, today)`: real calendar date, year >= 1950, not later than today + 1 day (UTC; tolerance for timezones). Checked after zod, with route-specific messages.

Path ids are UUIDs (Postgres `uuid`). A malformed (non-UUID) id is not validated by the route; the DB query will throw and `withRoute` returns `500 { "error": "Errore interno" }` (unverified in practice, but no explicit guard exists).

---

## GET /api/pension
Route name: `pension.list` · Auth: session cookie required · Guards: country (DE blocked)

**Query params:** none.

**Response** `200`
```ts
interface PensionOverviewData {
  funds: Array<{
    id: string;            // uuid
    name: string;
    adhesionDate: string;  // "YYYY-MM-DD", date of first adhesion to any pension scheme (drives exit tax rate)
    snapshots: Array<{
      id: string;              // uuid
      date: string;            // "YYYY-MM-DD"
      netContributions: number; // NUMBER (converted from numeric via Number())
      value: number;            // NUMBER
    }>; // sorted by date ascending
  }>;   // sorted by createdAt ascending (oldest fund first)
}
```
Note: unlike most of the API, money fields here are JSON **numbers**, not strings.
```json
{ "funds": [ { "id": "6c0b…", "name": "Fondo Cometa", "adhesionDate": "2012-03-01",
  "snapshots": [ { "id": "a1…", "date": "2024-12-31", "netContributions": 18250.4, "value": 21430.12 } ] } ] }
```

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 403 | `{ code: "country_feature_unavailable", error }` | DE user |

**Side effects:** none.
**Mobile notes:** this single payload feeds every Pension tab; all derived numbers (contributions per year from snapshot deltas, returns, exit tax, rate simulation) are computed client-side on web. Native apps must reimplement them (see Gaps in report).

---

## GET /api/pension/view

Route name: `pension.view` · Auth: session · Guards: proxy + `withCountryGuard` (DE → 403 `country_feature_unavailable`)
Source: `app/api/pension/view/route.ts`, `lib/views/pension.ts` (`buildPensionView`, pure), `lib/views/pension.server.ts`,
`pensionViewSchema` in `lib/views/schemas.ts`. Status: implemented on branch `feat/mobile-api-foundations` (G10).

Runs what `PensionProvider` and the tabs compute in the browser: `computePensionPerformance`, `deriveContributions`,
`withdrawalScenarios`, `companyTfrValue(…, ASSUMED_INFLATION = 0.02)`, `recentQuarterlyContribution`,
`projectPension` (25-year preview, rates 0 / 2% / 4%), `yearlyBreakdown`, `exitTaxMilestones`, plus
`withdrawalScenarios(…, years)` for **every** whole year 0–35 so the «Scenari» drag only indexes into
`exitTax.timeline`. The «Proiezione» sliders (years 1–45, quarterly contribution 0–3000 step 20) stay on the device:
port `projectPension` ([domain/pension.md](../../domain/pension.md)); their settings and defaults are in `projection.sliders`.

**Query params**: `fundId` (uuid, default: first fund, as the web), `today` (`YYYY-MM-DD`, default: the **UTC** day, as
the web's `todayIso`). Fixture: [pension-view.json](../fixtures/pension-view.json).

```ts
interface PensionView {
  currency: string; today: string;
  funds: { id; name; adhesionDate; snapshotCount: number; lastDate: string | null }[];   // fund picker
  fund: PensionFundData | null;                 // selected fund with its snapshots (chart «Andamento»); null without funds
  last: PensionSnapshotData | null;             // null → «nessuna fotografia» empty state
  performance: { value; netContributions; gain; gainPct; annualReturn; approximate; firstDate; lastDate } | null;
  contributions: { date; amount; estimated }[];
  scenarios: { reason: "pensionamento" | "sanitarie" | "altri"; rate; netLow; netHigh }[];   // with the real years
  tfr: { gross; net; annualRate } | null;       // TFR left with the employer
  assumedInflation: number;                     // 0.02
  quarterly: number;                            // average quarterly contribution, last 12 months (0 without history)
  yearly: { year; contributions; gain; endValue; returnRate; partial }[];
  projection: {
    preview: { year: 25; prudent; base; optimistic } | null;   // Panoramica «tra 25 anni» (uses .base)
    years: 25; rates: { prudent: 0; base: 0.02; optimistic: 0.04 };
    sliders: { years: { min: 1; max: 45; step: 1; default: 25 }; quarterlyContribution: { min: 0; max: 3000; step: 20; default } };
  };
  exitTax: {
    realYears: number; rate: number;            // years of participation today and the reduced rate
    milestones: { reductionStartsOn; minRateOn } | null;
    maxYears: 35;
    timeline: { years: number; rate: number; scenarios: WithdrawalScenario[] }[];   // 36 entries, index = years
  };
}
```

| Status | Body | When |
|---|---|---|
| 400 | `{ code: "validation_failed", field: "fundId" }` / `{ code: "invalid_date", field: "today" }` | malformed params |
| 404 | `{ code: "pension_fund_not_found" }` | `fundId` is not one of the user's funds |
| 403 | `{ code: "country_feature_unavailable" }` | DE |

---

## POST /api/pension/funds
Route name: `pension.funds.create` · Auth: session · Guards: country

**Request body** (`application/json`)
```ts
interface CreatePensionFund {
  name: string;          // trimmed, 1..80 chars
  adhesionDate: string;  // "YYYY-MM-DD", plausible (>=1950, <= today+1)
}
```
**Response** `201` `{ "id": "<uuid>" }`

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "<first zod issue>" }` | invalid/missing body (non-JSON body parses as `null` -> zod error) |
| 400 | `{ error: "Data di adesione non valida" }` | date not plausible |
| 400 | `{ error: "Puoi tracciare al massimo 10 fondi" }` | user already has 10 funds |
| 401 | empty | no session |
| 403 | country body | DE |

**Side effects:** insert into `pension_funds`. Log `pension.fund.created`.

---

## PATCH /api/pension/funds/{id}
Route name: `pension.funds.update` · Auth: session · Guards: country

**Path params:** `id` uuid (fund id).

**Request body**
```ts
interface UpdatePensionFund {
  name?: string;         // trimmed, 1..80
  adhesionDate?: string; // "YYYY-MM-DD", plausible
} // at least one field required, else "Niente da aggiornare"
```
**Response** `204` empty body.

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "<first zod issue>" }` | invalid body / `"Niente da aggiornare"` |
| 400 | `{ error: "Data di adesione non valida" }` | implausible date |
| 404 | `{ error: "Fondo non trovato" }` | fund missing or owned by another user (indistinguishable) |
| 401 / 403 | empty / country body | |

**Side effects:** updates `name` / `adhesionDate`, `updatedAt = now()`. Log `pension.fund.updated`.

---

## DELETE /api/pension/funds/{id}
Route name: `pension.funds.delete` · Auth: session · Guards: country

**Response** `204` empty.
**Errors:** `404 { error: "Fondo non trovato" }`; 401; 403 country.
**Side effects:** deletes the fund; `pension_snapshots` rows cascade (FK `onDelete: cascade`). Log `pension.fund.deleted`.
**Mobile notes:** destructive and irreversible; confirm in UI.

---

## POST /api/pension/funds/{id}/snapshots
Route name: `pension.snapshots.create` · Auth: session · Guards: country

**Request body**
```ts
interface CreatePensionSnapshot {
  date: string;             // "YYYY-MM-DD", plausible
  netContributions: number; // 0..1e8, JSON number
  value: number;            // 0..1e8, JSON number
}
```
Values are stored rounded via `toFixed(2)`.

**Response** `201` `{ "id": "<uuid>" }` — the id of the inserted **or updated** row (upsert on unique `(fund_id, date)`: if a snapshot already exists for that date its `netContributions` and `value` are replaced and the existing id is returned).

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "<first zod issue>" }` | invalid body |
| 400 | `{ error: "Data non valida" }` | implausible date |
| 400 | `{ error: "Hai raggiunto il numero massimo di fotografie" }` | fund already has >= 5000 snapshots (checked even when the call would only update an existing date) |
| 404 | `{ error: "Fondo non trovato" }` | |
| 401 / 403 | | |

**Side effects:** upsert into `pension_snapshots`. Log `pension.snapshot.saved`.
**Mobile notes:** idempotent per (fund, date); safe to retry.

---

## DELETE /api/pension/funds/{id}/snapshots/{snapshotId}
Route name: `pension.snapshots.delete` · Auth: session · Guards: country

**Response** `204` empty.
**Errors:** `404 { error: "Fotografia non trovata" }` when no row matches `(snapshotId, fundId = id, userId)`; 401; 403.
**Side effects:** single-row delete. Log `pension.snapshot.deleted`.

---

## POST /api/pension/funds/{id}/snapshots/import
Route name: `pension.snapshots.import` · Auth: session · Guards: country

The file (CSV / XLSX / pasted text) is **never uploaded**: the client parses it, maps columns, and sends normalized rows as JSON. Web does this with `lib/pension/import/mapping.ts` (`readCsvTable`, `suggestPensionColumns`, `normalizePensionRows`, template headers `Data;Contributi netti;Controvalore`) and `lib/pension/import/xlsx.ts` (max file 5 MB, max 5000 sheet rows, Excel serial dates). The client also computes a preview with the same `planSnapshotImport` function; the server recomputes it against real state.

**Request body** (`application/json`)
```ts
interface ImportPensionSnapshots {
  format: "csv" | "xlsx" | "incollato";   // informational source format
  rows: Array<{                            // 1..1000 items ("Nessuna riga da importare" / "Al massimo 1000 righe per import")
    line: number;            // int >= 1, original line number (used in messages)
    date: string;            // "YYYY-MM-DD"
    netContributions: number;// 0..1e8
    value: number;           // 0..1e8
  }>;
}
```

**Planning rules** (`planSnapshotImport`): per row, status is
- `error` if date not plausible ("Data nel futuro o troppo vecchia") or the same date appeared earlier in the file with different values ("Stessa data della riga N con valori diversi");
- `unchanged` if same date earlier in file with equal values ("Uguale alla riga N"), or equals the saved snapshot (compared in cents);
- `update` if a saved snapshot exists for that date with different values (`previous` included);
- `new` otherwise.
Whole-import error if `existing + new > 5000`: "Il fondo avrebbe più di 5000 fotografie".

**Response** `201`
```ts
{ counts: { new: number; update: number; unchanged: number; error: number } } // error is always 0 here
```
```json
{ "counts": { "new": 12, "update": 1, "unchanged": 3, "error": 0 } }
```

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "<first zod issue>" }` | schema failure |
| 400 | `{ error: string; rows: PlannedSnapshotRow[]; counts: {...} }` | any row in `error` or whole-plan error. `error` = plan error or `"Alcune righe non sono valide"`. Nothing is written. |
| 404 | `{ error: "Fondo non trovato" }` | |
| 401 / 403 | | |

```ts
interface PlannedSnapshotRow {
  line: number; date: string;
  status: "new" | "update" | "unchanged" | "error";
  message?: string;
  previous?: { netContributions: number; value: number }; // numbers
}
```

**Side effects:** single DB transaction; rows with status `new`/`update` upserted in chunks of 200 (`onConflictDoUpdate` on `(fund_id, date)`). Logs `pension.snapshots.imported` / `pension.snapshots.import_rejected` (counts only, never content).
**Mobile notes:** all-or-nothing; re-importing the same file is a no-op (all `unchanged`). Native apps must implement CSV/XLSX parsing and column mapping themselves (or limit to pasted/CSV input).

## Cross-cutting observations
- Money fields in this resource are JSON **numbers** in both requests and responses (route converts `numeric` with `Number()`), deviating from the "numeric as string" default.
- The import 400 response carries extra fields (`rows`, `counts`) beyond `error`.
- Create endpoints return only `{ id }`; PATCH/DELETE return 204 with empty body. Client must refetch `GET /api/pension` after mutations.
