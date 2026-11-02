# Price history: coverage decides whether to ask, not the first stored price

Date: 2026-11-02
Status: accepted

## Context

`ensureHistory` decided whether to start a backfill with a single query:

```ts
const firstPrice = await findFirstPriceDate(instrument.id);
if (firstPrice !== null && firstPrice <= fromKey) return false;
```

That answers "is there any stored close at or before the requested date", but it was used to answer
"is the requested interval covered". The two are different questions, and the second one was never
being asked. With a lone old close stored, the backfill was skipped even when the whole requested
period was empty.

The effect was visible and permanent. `GET /api/instruments/[id]/price?date=…` calls
`findPriceOnDate` over a 10-day window; if it finds nothing it calls `ensureHistorySafely`, which
delegated to `ensureHistory`. With an isolated old close, no backfill was scheduled, so the route
answered `{ price: null, loading: false }` — repeated forever, since a state that never becomes
`running` never gets a heartbeat and the attempt cooldown simply expired and allowed the same
no-op again.

This is reachable in normal use: an instrument created with the 30-day `INITIAL_HISTORY_DAYS`
backfill, or one whose history was reset, then given a hand-typed operation dated long before those
30 days, has exactly this shape.

The same inference also missed inner gaps: closes at January and October with February–September
missing satisfied `min(date) <= fromKey`.

## Decision

**Coverage decides whether to ask; `ensureHistory` pursues the interval it is given.** The two
responsibilities are separated:

- `market-data` does not inspect stored prices to decide anything. `ensureHistory` claims a run
  and backfills the interval requested. Backfills are idempotent (missing days only), so asking
  again is safe.
- `investments` decides whether asking is worthwhile, because it knows the interval it needs — an
  operation date plus `HISTORY_MARGIN_DAYS`, the period of a chart, 380 days for a watchlist.
  `historyCovers()` calls the new `findCoveredFrom(instrumentId, toKey, maxGapDays)`.

`findCoveredFrom` returns the start of the stored coverage that reaches the requested end:

1. The newest close within `toKey` must be within `maxGapDays` of `toKey`. If data stops long
   before, the interval is not covered — this is the case that caused the bug.
2. From there it walks backwards, stopping at the first gap between two **consecutive** closes
   wider than `maxGapDays`.

The tolerance is `DAILY_LOOKBACK_DAYS` (7), the same one the daily update re-reads, so weekends,
holidays and a missed cron run are not mistaken for gaps. Gaps are measured between consecutive
closes rather than from an anchor date; measuring from an anchor makes a lone old price look like
full coverage, which is the original defect in a new form.

Separately, `tryStart` now claims with `SET NX` (`setIfAbsent`, backed by Redis `NX` and by the
in-memory KV in tests), so two simultaneous requests across pods cannot both start the same
backfill. It also records the requested `fromKey` and holds a `BACKFILL_COOLDOWN_MS` (6 h) cooldown
after a **completed** run, distinct from the 60 s heartbeat staleness: an interrupted run stays
resumable, while a source that does not know an interval is not asked again in a loop.

## Consequences

- The operation-price endpoint starts a backfill instead of answering `loading: false` forever.
- Inner gaps are recognised; the only remaining blind spot is a gap *older* than
  `maxGapDays` below the newest close, which the 7-day daily window bounds.
- A caller that does not use `historyCovers()` will re-request intervals (harmless, idempotent, and
  bounded by the cooldown). Callers updated here: `ensureHistorySafely`, `title-view.ts` and the
  watchlist route.
- No migration, no schema change, no new dependency.

## Deferred

**Coverage metadata.** Verified coverage is still *inferred* from close dates and a tolerance, so a
period the provider genuinely has no data for cannot be told apart from one never requested; the
cooldown is a heuristic standing in for that distinction. A table recording requested intervals,
provider and outcome (`instrument_price_coverage`) would make it explicit, and would allow a
confirmed-absence cooldown separate from a temporary error. Worth doing when backfill traffic
justifies it; it does not change the correctness fixed here.

Also deferred: an on-demand backfill per interval that does not depend on the caller's judgment, and
manager-API/native paths that may request intervals without the `historyCovers` guard.

## Verification

- `lib/investments/history-ensure.integration.test.ts` (database, against the real store): a
  backfill starts with a much older close stored; `findCoveredFrom` recognises an inner gap, is not
  fooled by a lone old price, does not read a weekend as a gap, ignores closes after the requested
  date and returns null on an empty history; simultaneous `ensureHistory` calls start one run; a
  stale run resumes while a live one does not; a manual instrument is never backfilled.
- `app/api/instruments/[id]/price/route.test.ts`: the endpoint answers `loading: true` and records a
  running backfill for the requested interval; it does not start one when the day's close exists.
- `lib/market-data/backfill-state.test.ts`: cooldown after a completed run but not after a failure,
  and one winner among simultaneous starts.
- Living docs updated: `docs/architecture/market-data.md` (§4.8, §5, §6) and
  `docs/architecture/background-jobs.md` (§4.5).
