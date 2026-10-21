# Net worth history

Feature area(s): Panoramica / Patrimonio charts (net-worth over time by asset class), any screen that plots historical liquidity / investments / pension / debts. Available for IT and DE.
Source: `app/api/net-worth/snapshots/route.ts`, `lib/net-worth/*`, `lib/db/schema/net-worth-snapshots.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | /api/net-worth/snapshots | Daily rows per asset class in a date range (stored + derived), optional compaction | session | Performs lazy DB writes (backfill/refresh) before reading |

No country gate (for DE users the pension class is simply empty because `loadUserPension` returns no funds). No demo guard. No jobs.

---

## GET /api/net-worth/snapshots
Route name: `net_worth.snapshots` · Auth: session cookie required · Guards: none

**Query params**
| Name | Type | Required | Default | Constraints |
|---|---|---|---|---|
| from | string | yes | — | `YYYY-MM-DD` (regex only, no calendar check) |
| to | string | yes | — | `YYYY-MM-DD`, inclusive |
| compact | string | no | — | `"1"` enables compaction; any other value ignored |

**Response** `200` — a flat JSON **array** (no envelope) concatenating three sources:

1. Stored rows from `net_worth_snapshots` (classes `liquidita`, `investimenti`) with `from <= date <= to`, sorted by date asc — full DB row:
```ts
interface StoredSnapshotRow {
  id: string; userId: string;
  date: string;                       // "YYYY-MM-DD"
  assetClass: "liquidita" | "investimenti";
  amount: string;                     // STRING numeric(14,2), e.g. "12034.55"
  source: "snapshot" | "derivato";    // snapshot = written by daily cron; derivato = reconstructed
  createdAt: string; updatedAt: string; // ISO-8601
}
```
2. Derived debt rows (never stored; recomputed from debt plans + events), one per day from `max(from, first debt residual date)` to **yesterday** (UTC), filtered `<= to`:
```ts
{ date: string; amount: string /* NEGATIVE, toFixed(2), e.g. "-139800.12" */; source: "derivato"; assetClass: "debiti" }
```
3. Derived pension rows (never stored; last known snapshot value of each fund summed), one per day from `max(from, first pension snapshot)` to yesterday, filtered `<= to`:
```ts
{ date: string; amount: string /* toFixed(2) */; source: "derivato"; assetClass: "previdenza" }
```

Derived rows have **no** `id`, `userId`, `createdAt`, `updatedAt`. The concatenated array is **not globally sorted** (stored rows sorted, then debt rows, then pension rows); sort client-side by `(date, assetClass)`.

With `compact=1` (`compactSnapshotRows(all, today)`): rows within the last 400 days (`COMPACT_KEEP_DAYS`) are kept in full; older rows are reduced, per asset class, to the last row of each month plus the very first row of the class. Relative order is preserved.

```json
[
  { "id": "9e…", "userId": "u_…", "date": "2026-10-16", "assetClass": "liquidita", "amount": "15230.40", "source": "snapshot",
    "createdAt": "2026-10-16T21:00:03.000Z", "updatedAt": "2026-10-16T21:00:03.000Z" },
  { "id": "a2…", "userId": "u_…", "date": "2026-10-16", "assetClass": "investimenti", "amount": "48210.00", "source": "derivato",
    "createdAt": "2026-10-17T08:00:00.000Z", "updatedAt": "2026-10-17T08:00:00.000Z" },
  { "date": "2026-10-16", "amount": "-139800.12", "source": "derivato", "assetClass": "debiti" },
  { "date": "2026-10-16", "amount": "21430.12", "source": "derivato", "assetClass": "previdenza" }
]
```

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "from e to sono obbligatori nel formato YYYY-MM-DD" }` | missing / malformed `from` or `to` |
| 401 | empty | no session |
| 500 | `{ error: "Errore interno" }` | unhandled error (e.g. an impossible date like `2026-02-31` reaching Postgres — unverified) |

**Side effects** (run synchronously on every call, before reading):
- `backfillDerivedHistory(userId)`: one-off reconstruction of `liquidita` history from transactions of `source = "auto"` (bank-synced) accounts; no-op if the user already has any `liquidita` row. Inserts with `onConflictDoNothing`.
- `refreshDerivedInvestmentHistory(userId)`: recomputes past-day `investimenti` rows (from first investment transaction up to yesterday, max 20 years) from stored operations and prices, only when an input fingerprint stored in **Redis** has changed; rewrites only changed days; deletes past rows if no operations. Today's row is written by the evening cron, not here.
- No external API calls (uses stored prices).

**Mobile notes**
- Today's values are not included for `debiti`/`previdenza` (series stop at yesterday) and today's `liquidita`/`investimenti` row exists only after the daily cron. Web composes the "current" point from live values (account balances, investments overview, `GET /api/debts` overview `totalResidual`, `GET /api/pension` latest snapshots).
- First call after data changes can be slow (history recomputation). Use `compact=1` for long ranges (e.g. "all time") to keep the payload small.
- Amounts are strings; parse as decimal. Net worth = sum over classes (debts already negative).
- Series aggregation on web uses `buildNetWorthSeries` in `lib/calc/net-worth.ts` (client-side step-function; monthly last values beyond one year) — native must reimplement.
