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
being asked.

**When it actually bites.** The check only skips when a stored close sits at or before `fromKey`.
That is not the ordinary "created yesterday, operation from two years ago" case: there
`firstPrice` (today − 30) is *after* `fromKey`, the condition is false, and the backfill starts. A
plain 30-day initial backfill followed by an older operation is therefore **not** affected.

The defect needs one of these shapes:

- **An isolated close older than the requested interval.** The oldest close precedes `fromKey`, so the
  check skips, while the requested period is empty. Example: closes exist only up to some old date,
  then a long gap, then the instrument is asked for a period inside the gap.
- **An inner gap.** Closes at January and October with February–September missing satisfy
  `min(date) <= fromKey`, so a request for a period in the middle is refused even though it is empty.

The visible effect is on `GET /api/instruments/[id]/price?date=…`, which pre-fills the price of an
operation: it calls `findPriceOnDate` over a 10-day window, and when that finds nothing it calls
`ensureHistorySafely`. With no backfill scheduled, the route answers `{ price: null, loading: false }`
— and keeps answering the same way, because a run that never starts never gets a heartbeat, so the
attempt cooldown simply expires and allows the same no-op again.

## Decision

**Coverage decides whether to ask; `ensureHistory` pursues the interval it is given.** The two
responsibilities are separated:

- `market-data` does not inspect stored prices to decide anything. `ensureHistory` claims a run
  and backfills the interval requested. Backfills are idempotent (missing days only), so asking
  again is safe.
- `investments` decides whether asking is worthwhile, because it knows the interval it needs — an
  operation date plus `HISTORY_MARGIN_DAYS`, the period of a chart, 380 days for a watchlist.
  `historyCovers()` calls the new `findCoveredFrom(instrumentId, fromKey, toKey, maxGapDays)`.

`findCoveredFrom` returns the start of the stored coverage that reaches the requested end:

1. The newest close within `toKey` must be within `maxGapDays` of `toKey`. If the stored data stops
   long before, the interval is not covered — the isolated-close shape.
2. From there it walks backwards, stopping at the first gap between two **consecutive** closes
   wider than `maxGapDays`.

The tolerance is `DAILY_LOOKBACK_DAYS` (7), the same one the daily update re-reads, so weekends,
holidays and a missed cron run are not mistaken for gaps. Gaps are measured between consecutive
closes rather than from an anchor date; measuring from an anchor makes a lone old price look like
full coverage, which is the original defect in a new form. The read is bounded to
`fromKey - maxGapDays .. toKey`, and the walk stops as soon as coverage reaches `fromKey`: older
closes cannot change the answer, and loading the whole history (up to 20 years of daily rows) on
every title page and operation-price request would replace a single `min()` with a full table scan.

Separately, `tryStart` now claims with `SET NX` (`setIfAbsent`, backed by Redis `NX` and by the
in-memory KV in tests), so two simultaneous requests across pods cannot both start the same
backfill. It also records the requested `fromKey` and holds a `BACKFILL_COOLDOWN_MS` (6 h) cooldown
after a **completed** run, distinct from the 60 s heartbeat staleness: an interrupted run stays
resumable, while a source that does not know an interval is not asked again in a loop.

The cooldown is keyed on the interval, not just the instrument: it applies only when the completed
run already asked for an interval starting at or before the one now requested. Without that, a
finished 30-day backfill would block a two-year-old operation entered right afterwards — the most
common flow there is, and a regression the first version of this change introduced. A state written
before `fromKey` existed carries no interval and therefore covers nothing. Because
`backfillInstrument` always runs from `fromKey` to today, a completed run does cover any later
request, so only earlier intervals are allowed through.

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
  fooled by a lone old close, does not read a weekend as a gap, ignores closes after the requested
  end date, reports coverage only when it reaches the requested start, is unaffected by closes older
  than the window, and returns null on an empty history; simultaneous `ensureHistory` calls start one
  run; a stale run resumes while a live one does not; an older interval starts right after a
  completed recent backfill; a manual instrument is never backfilled.
- `app/api/instruments/[id]/price/route.test.ts`: the endpoint answers `loading: true` and records a
  running backfill for the requested interval; it does not start one when the day's close exists.
- `lib/market-data/backfill-state.test.ts`: cooldown only for an interval the completed run already
  covered, never after a failure, not for an older interval, not for a state written before `fromKey`
  existed; one winner among simultaneous starts.
- Living docs updated: `docs/architecture/market-data.md` (§4.8, §5, §6) and
  `docs/architecture/background-jobs.md` (§4.5).

## Review notes

Three points raised in review of the first version, all addressed:

1. **The cooldown ignored the interval**, so a completed 30-day backfill blocked a two-year-old
   operation for 6 h — a regression on the most common flow. `isCoolingDown` now takes the requested
   `fromKey` and only refuses when the completed run already asked for an interval at or before it.
2. **The "normal use" reproduction was wrong**: a 30-day initial backfill followed by an older
   operation does *not* hit the old bug, because `firstPrice` (today − 30) is after `fromKey`. The
   Context section above now states the two shapes that actually trigger it.
3. **`findCoveredFrom` read the whole history** on every title page and operation-price request,
   where the previous check was a single `min()`. It now takes `fromKey`, bounds the query to
   `fromKey - maxGapDays .. toKey`, and stops as soon as coverage reaches `fromKey`.

New comments and JSDoc in the touched files were also translated to English, per the repository
language rule (2026-10-15).
