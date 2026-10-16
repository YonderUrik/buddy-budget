# GoCardless sync performance optimization (import of found accounts + manual sync)

> **SUPERSEDED (2026-09-22)** — never implemented and no longer valid (`categorize.ts` removed by rule-based categorization). Replaced by `docs/superpowers/specs/2026-09-22-gocardless-sync-job-progress-design.md`.

Date: 2026-09-10

## Problem

The user reports that:
1. When selecting the "Conti Trovati" ("Found accounts", the bank-link finalization step), the transaction import is extremely slow.
2. Manual sync of a single account (the "Sincronizza ora" ("Sync now") button in Conti (Accounts)) is also extremely slow.
3. On Vercel, sync often doesn't work at all ("non riesco a sincronizzare nulla" — "I can't sync anything").

## Root cause (`superpowers:systematic-debugging` investigation)

In `lib/gocardless/sync.ts`, `syncAccountLink` imports the transactions downloaded from GoCardless with a **sequential** `for...await`, and runs **3 DB queries for every single transaction**:

1. `resolveCategoryId` (`lib/gocardless/categorize.ts:41`) calls `getFallbackCategoryId` — a **repeated query** even though `syncAccountLink` has already fetched the same value once before the loop (line 70).
2. `matchCategoryId` — a `SELECT` with `ILIKE` on the `transactions` table to find the latest transaction with a similar description.
3. A single `INSERT` per row (with `onConflictDoNothing` for idempotency).

For an initial import with hundreds of historical transactions, this means hundreds × 3 DB round-trips executed **one at a time**, never in batch or in parallel.

Aggravating factor in `app/api/gocardless/connections/[id]/finalize/route.ts` (lines 90-96): if the user selects several accounts on the "Conti trovati" screen (`app/(app)/conti/collega/[connectionId]/page.tsx`), the accounts themselves are also synced **sequentially** (another `for...await`), multiplying the total time linearly.

On Vercel the effect is amplified: Postgres is self-hosted on a k3s cluster (not a pooled/co-located Vercel Marketplace DB), so every serverless↔DB round-trip pays full network latency. Hundreds of sequential round-trips can exceed the function timeout, causing the "doesn't sync anything" symptom instead of a simple delay.

**Out of scope for this plan**: if after the fix syncs on Vercel remain completely broken (not just slower), it is likely a Vercel↔self-hosted Postgres connectivity/firewall issue separate from query performance — to be investigated separately by checking the Vercel logs (not yet done by the user at the time of this spec).

## What does NOT change

- The category matching logic: it stays "latest transaction with a similar description (case-insensitive), otherwise fallback category" — only *where* it is computed changes (in memory instead of one query per transaction).
- The database schema.
- The user-visible behavior of categorizing imported transactions.
- The import's idempotency semantics (no duplicates on every sync, based on the unique constraint `(accountId, externalId)`).
- `resolveCategoryId`/`getFallbackCategoryId`/`matchCategoryId` in `lib/gocardless/categorize.ts` stay unchanged as public functions: they are also used by `app/api/transactions/categorize-suggestions/route.ts` (the "Categorizza automaticamente" ("Categorize automatically") wizard in Transazioni (Transactions)), out of scope here.

## Design

### 1. Matcher preloaded in memory (`lib/gocardless/categorize.ts`)

New function:

```ts
export interface CategoryMatcher {
  fallbackCategoryId: string;
  match(description: string): string;
}

export async function buildCategoryMatcher(userId: string): Promise<CategoryMatcher>
```

Implementation:
- Fetches `fallbackCategoryId` once (`getFallbackCategoryId`, unchanged).
- Fetches in a single query **all** the user's transactions with a category other than the fallback, selecting only `description`, `categoryId`, `date`, ordered by `date DESC`.
- Builds a `Map<string, string>` (key: description normalized lowercase+trim, value: `categoryId` of the most recent transaction with that description — the first one met in DESC order wins, same semantics as the existing `ORDER BY date DESC LIMIT 1`).
- `match(description)` normalizes the incoming description the same way and does a Map lookup; returns `fallbackCategoryId` if not found.

Note: the existing matching uses `ilike` (case-insensitive, with no explicit wildcards, so equivalent to case-insensitive equality) — the in-memory lowercase+trim normalization reproduces the same behavior without introducing a new fuzzy match.

### 2. `syncAccountLink` (`lib/gocardless/sync.ts`)

- Builds the matcher once (`buildCategoryMatcher(link.userId)`) instead of calling `resolveCategoryId` for each transaction.
- In the loop over the downloaded transactions, computes `categoryId = matcher.match(description)` — **zero queries per transaction**.
- Replaces the single insert with a **batch insert**: builds the array of all rows to insert (filtering out those without `externalId`, as today), then a single call:

  ```ts
  db.insert(transactions)
    .values(rows)
    .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
    .returning({ categoryId: transactions.categoryId })
  ```

- The counters (`newTransactionsCount`, `categorizedCount`, `uncategorizedCount`) are computed from the returned result (rows actually inserted, excluding those dropped by `onConflictDoNothing`), same logic as today applied to the batch result instead of row by row.
- If `rows` is empty (no new transactions from GoCardless, or all without `externalId`), the insert is skipped (no pointless DB call).

Result: from N×3 sequential queries to **2 queries in total** for matching+insert (one `SELECT` for the matcher, one batch `INSERT`), regardless of the number of transactions.

### 3. Parallel multi-account sync (`app/api/gocardless/connections/[id]/finalize/route.ts`)

The final loop:
```ts
for (const link of linksToSync) {
  try { await syncAccountLink(link, redisRateLimitStore); }
  catch (error) { console.error(...); }
}
```
becomes:
```ts
await Promise.all(
  linksToSync.map((link) =>
    syncAccountLink(link, redisRateLimitStore).catch((error) => {
      console.error(`Sync iniziale fallito per il conto ${link.accountId}`, error);
    })
  )
);
```
Behavior unchanged (best-effort, a failure on one account blocks neither the others nor the response) — only execution changes from sequential to parallel. Safe because the GoCardless rate limit (`isRateLimited`/`recordRateLimit`) is tracked per `externalAccountId`, hence independent across accounts.

The cron scheduler (`lib/gocardless/scheduler.ts`, `runDueSyncs`) **is not touched**: it runs every 12h in the background and blocks no user request — sequential execution there is not the reported problem. It still benefits indirectly from the speed-up of `syncAccountLink` per account.

### 4. UI feedback (spinner + explicit text)

- **`app/(app)/conti/collega/[connectionId]/page.tsx`**: the "Conferma" ("Confirm") button (lines 129-131), when `finalize.isPending`, shows the text "Sincronizzazione in corso, può richiedere qualche minuto..." ("Sync in progress, it may take a few minutes...") instead of an unchanged "Conferma" that is merely `disabled`.
- **`components/domain/accounts/account-row.tsx`**: the manual sync button (lines 233-244) already shows a spinner (`RefreshCw` with `animate-spin` when `syncMutation.isPending`) but no text — add a small text next to the icon (e.g. a dynamically updated tooltip/`title`, or an inline text label while pending) with the same explicit message.

No other change to state/queries (no account-by-account progress streaming: discarded during brainstorming as unnecessary complexity compared with the performance fix, which should already reduce the wait from minutes to seconds).

## Testing

- `lib/gocardless/categorize.test.ts`: new tests for `buildCategoryMatcher` — the matcher returns the category of the latest transaction with the same description (case-insensitive), fallback if no match, behavior unchanged compared with the existing tests of `resolveCategoryId`/`matchCategoryId` (which stay, are not removed).
- `lib/gocardless/sync.test.ts`: update the existing `syncAccountLink` tests to reflect the batch insert (same observable behavior: correct counts, idempotency on duplicate `externalId`, category correctly assigned) + a new test with several transactions to verify that in-memory matching consistently assigns different categories within the same batch.
- `app/api/gocardless/connections/[id]/finalize/route.test.ts`: verify that several accounts are synced even if one of the two fails (best-effort behavior unchanged, now with `Promise.all`).

## Manual verification by the user (out of the agent's scope, no real Postgres/browser in the sandbox)

- Link a sandbox bank with several accounts and many historical transactions, measure the "Conferma" time before/after.
- Manual sync on an account with many not-yet-imported transactions.
- **On Vercel**: repeat the same test after deploy. If sync works again (even if slowly) the fix solves the problem. If it remains completely broken, check the Vercel logs for the exact error (timeout vs connection refused vs other) — it indicates a separate connectivity issue to investigate in a dedicated session.
