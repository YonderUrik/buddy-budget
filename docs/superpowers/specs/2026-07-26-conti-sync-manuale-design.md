# Conti: visible last sync + manual sync with throttle + outcome feedback

Date: 2026-07-26

## Context

User request: in the Conti (Accounts) screen, for each account connected via GoCardless (`source: "auto"`), show when the last synchronisation happened and allow forcing a manual sync, respecting a cap of **at most 4 syncs per day per account and at least 4 hours between one sync and the next**. After the sync, show feedback with how many new transactions were found, how many were categorised automatically, how many remained "Da categorizzare" ("To categorise").

What already exists today:
- `bankAccountLinks.lastSyncedAt`/`nextSyncEligibleAt` (columns present, but `lastSyncedAt` never exposed in the UI).
- A cron scheduler (`lib/gocardless/scheduler.ts`) that syncs every due account every 12h, handling a **real** GoCardless rate limit based on the response headers (`lib/gocardless/rate-limit.ts`, per endpoint `balances`/`transactions`), conceptually different from the application cap requested here.
- No manual sync button in the UI (note already present in CLAUDE.md).
- No toast library in the project.

Decision clarified with the user in brainstorming: the cap of 4/day + minimum 4h gap is a **shared budget** between the automatic scheduler and manual clicks (not two separate counters), to stay aligned with the real GoCardless limit on the sandbox side (~4 calls/day/endpoint/account, already noted in CLAUDE.md), avoiding adding up the two channels beyond the quota. The post-sync feedback uses a **global toast** (the `sonner` library via shadcn, not yet in the project).

## Application throttle (shared budget)

New column on `bank_account_links`:

```ts
syncTimestamps: jsonb("sync_timestamps").notNull().default('[]'), // array of ISO strings, max 4 elements, most recent first
```

`lastSyncedAt`/`nextSyncEligibleAt` remain (the latter reduced from 12h to 4h as the minimum gap, used as a cheap query-side filter by the scheduler — see below).

New pure module `lib/gocardless/sync-eligibility.ts`:

```ts
export const MAX_SYNCS_PER_DAY = 4;
export const MIN_SYNC_GAP_MS = 4 * 60 * 60 * 1000;
export const SYNC_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SyncEligibility {
  eligible: boolean;
  syncsUsedToday: number;
  syncsRemainingToday: number;
  nextEligibleAt: Date | null; // null if eligible === true
}

export function computeSyncEligibility(recentSyncTimestamps: Date[], now: Date): SyncEligibility
```

Logic:
1. `recentInWindow` = timestamps with `now - t < SYNC_WINDOW_MS`, sorted ascending.
2. `syncsUsedToday = recentInWindow.length`; `syncsRemainingToday = max(0, MAX_SYNCS_PER_DAY - syncsUsedToday)`.
3. `lastSync` = the most recent of all past timestamps (even outside the window, for the minimum gap — irrelevant in practice because beyond 24h it always exceeds the 4h gap).
4. `minGapOk = !lastSync || now - lastSync >= MIN_SYNC_GAP_MS`.
5. `capOk = syncsUsedToday < MAX_SYNCS_PER_DAY`.
6. `eligible = minGapOk && capOk`.
7. `nextEligibleAt`: if `!minGapOk` → `lastSync + MIN_SYNC_GAP_MS`; otherwise if `!capOk` → `recentInWindow[0] + SYNC_WINDOW_MS` (the oldest of the 4 leaves the window); otherwise `null`.

A real sliding window (not a counter reset at fixed intervals): with at most 4 elements kept, filtering by age at every check is sufficient and precise.

The automatic scheduler (cron every 12h, unchanged) and the manual sync endpoint (below) both call this function before attempting a real sync, sharing the same `syncTimestamps` array per account — no distinction between "automatic budget" and "manual budget".

## `syncAccountLink` — extended result

`lib/gocardless/sync.ts`, `syncAccountLink` returns (instead of `void`) a discriminated result:

```ts
export type SyncResult =
  | { status: "synced"; newTransactionsCount: number; categorizedCount: number; uncategorizedCount: number; balanceUpdated: true }
  | { status: "gocardless-limited" } // real GoCardless rate limit (header-based), existing check
  | { status: "expired" };           // 401, existing behaviour unchanged
```

Internal changes:
- The two existing `isRateLimited` checks, if true, return `{ status: "gocardless-limited" }` instead of a silent `return;`.
- The transaction insert uses `.returning()` on the `onConflictDoNothing`: only the rows actually inserted count as "new". For each inserted row, compare its `categoryId` with `fallbackId` (already resolved once for the user via `getFallbackCategoryId`, reused in the loop instead of calling `resolveCategoryId` twice) to increment `categorizedCount` or `uncategorizedCount`.
- On success, a single update on `bankAccountLinks`: `lastSyncedAt = now`, `syncTimestamps` = `[now, ...previous].slice(0, 4)` (ISO strings), `nextSyncEligibleAt = now + MIN_SYNC_GAP_MS`.
- The 401 behaviour (marks `bankConnections.status = "expired"`) is unchanged, only the return value changes from `void` to `{ status: "expired" }`.

`runDueSyncs` (scheduler) ignores the return value (the current behaviour already logs only uncaught exceptions); however, before calling `syncAccountLink` for each due link, it adds a `computeSyncEligibility(link.syncTimestamps, now).eligible` check and silently skips (the same skip pattern already existing for the real rate limit) if the shared budget has already been used up by earlier manual syncs on the same day. `findDueLinks` extends the `select` to include `syncTimestamps`.

## Manual endpoint

New `app/api/gocardless/accounts/[accountId]/sync/route.ts`:

```
POST /api/gocardless/accounts/[accountId]/sync
```

- Auth check (like the other gocardless endpoints).
- Fetch of the link joining `bankAccountLinks` + `bankConnections`, filtering `accountId = params.accountId AND bankConnections.userId = session.user.id AND bankConnections.status = "linked"` (ownership + status, the IDOR-safe pattern already used elsewhere in this module). Not found → 404.
- `computeSyncEligibility(link.syncTimestamps, now)`: if `!eligible` → 429 `{ error: "not-eligible", nextEligibleAt, syncsRemainingToday }`, **no call to `syncAccountLink`** (avoids wasting real GoCardless quota on an attempt we already know is blocked).
- Otherwise call `syncAccountLink(link, redisRateLimitStore)` and map the result:
  - `synced` → 200 `{ status: "synced", newTransactionsCount, categorizedCount, uncategorizedCount }`
  - `gocardless-limited` → 429 `{ status: "gocardless-limited" }`
  - `expired` → 409 `{ status: "expired" }`

`GET /api/gocardless/connections` (existing status, `app/api/gocardless/connections/route.ts`) extended: the select also includes `lastSyncedAt`/`syncTimestamps` from the link, and the response computes `computeSyncEligibility` per row. New shape:

```ts
export interface BankConnectionStatus {
  accountId: string;
  status: "pending" | "linked" | "expired" | "error";
  lastSyncedAt: string | null;
  eligible: boolean;
  nextEligibleAt: string | null;
  syncsRemainingToday: number;
}
```

Additive extension: existing consumers (`reconnectAccountIds` in `ContiPage`, filtered by `status`) stay unchanged.

## UI

**Toast**: add `sonner` via shadcn (`pnpm dlx shadcn@latest add sonner`, generates `components/ui/sonner.tsx`, already theme-aware on `next-themes`); `<Toaster />` mounted in `app/layout.tsx` inside `<body>`, next to `ThemeProvider`.

**`formatRelativeTime`** (new, pure, in `lib/format.ts`): `(date: Date, now?: Date) => string` — "adesso" ("now", <1 min), "X min fa" ("X min ago", <60 min), "X h fa" (<24h), "X giorni fa" ("X days ago", <7 days), otherwise a short absolute date (e.g. "12 lug").

**`AccountRow`** (`components/domain/accounts/account-row.tsx`): new optional prop `syncInfo?: { lastSyncedAt: string | null; eligible: boolean; nextEligibleAt: string | null; syncsRemainingToday: number }`, populated only for `isAuto` rows. It adds:
- Muted text "Ultimo sync: {formatRelativeTime(...)}" ("Last sync") (or "Mai sincronizzato" — "Never synced" — if `lastSyncedAt` is null) near the Auto badge.
- `RefreshCw` icon button (icon already imported in the file) to start the manual sync via `useSyncAccountMutation(account.id)`. Disabled when `!eligible`, with a native `title` attribute explaining the reason ("Prossimo sync disponibile alle HH:MM" — "Next sync available at HH:MM" — for the minimum gap, "Limite di 4 sync al giorno raggiunto, prossimo alle HH:MM" — "Limit of 4 syncs a day reached, next at HH:MM" — for the daily cap) — no new Tooltip dependency, the browser `title` is enough for this use case.
- During the mutation, icon in a "spinning" state (`animate-spin` class, a common pattern with lucide-react), button disabled.

**`ContiPage`**: extends the map already built from `connectionStatuses` to include the sync fields too, passing `syncInfo` by `accountId` to each `AccountRow`.

**Mutation** (`lib/queries/gocardless.ts`), `useSyncAccountMutation`:

```ts
export function useSyncAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch(`/api/gocardless/accounts/${accountId}/sync`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new SyncNotAvailableError(body); // includes status/nextEligibleAt
      return body as SyncSuccessResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["gocardless", "connections", "status"] });
      toast.success(buildSyncSummaryMessage(result));
    },
    onError: (error: SyncNotAvailableError) => {
      toast.error(buildSyncErrorMessage(error));
    },
  });
}
```

`buildSyncSummaryMessage`/`buildSyncErrorMessage`: pure (testable) functions, e.g.:
- `{newTransactionsCount: 0}` → "Nessuna nuova transazione trovata. Saldo aggiornato." ("No new transactions found. Balance updated.")
- `{newTransactionsCount: 5, categorizedCount: 3, uncategorizedCount: 2}` → "5 nuove transazioni (3 categorizzate, 2 da categorizzare). Saldo aggiornato." ("5 new transactions (3 categorised, 2 to categorise). Balance updated.")
- `gocardless-limited` → "La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi." ("The bank has temporarily run out of available calls. Try again later.")
- `expired` → "Sessione con la banca scaduta. Riconnetti il conto per sincronizzare." ("Bank session expired. Reconnect the account to sync.")
- `not-eligible` (429 pre-check) → "Hai raggiunto il limite di sync per ora. Prossimo disponibile alle {ora}." ("You have reached the sync limit for now. Next available at {time}.")

## Migration

The new `sync_timestamps` column must be applied with `pnpm db:push` **by the user** (not by an agent — local DB shared with `main`, a convention already established in CLAUDE.md for the earlier columns on `categories`).

## Edge cases

- Account just connected, never synced: `lastSyncedAt` null → "Mai sincronizzato", empty `syncTimestamps` → always eligible (no gap/cap to respect).
- Manual sync while the scheduler has just used the day's last slot: button disabled in the UI (state computed by `GET /api/gocardless/connections`), and in any case re-checked server-side in the sync endpoint (we do not trust the client alone).
- Connection with several linked accounts (`bankConnections` 1-N `bankAccountLinks`): the budget is per **account** (`bankAccountLinks.syncTimestamps`), not per connection — syncing one account does not consume the budget of the other accounts at the same bank.
- Sync that fails halfway (e.g. balance OK, then a network error on the transactions): no atomic DB transaction introduced, best-effort row-by-row behaviour unchanged from today; in this case the exception propagates (it is neither `synced` nor a handled state), the endpoint lets it bubble up as a generic 500 and the error toast uses a fallback message.

## Tests

- `lib/gocardless/sync-eligibility.test.ts` (new): 4h gap boundary (just below/above), 4/24h cap boundary (the fifth attempt within 24h of the oldest of the 4 blocks, it leaves the window 24h after the oldest), empty array → always eligible, correct `nextEligibleAt` in both blocking cases.
- `lib/gocardless/sync.test.ts` (extended): assertions on the discriminated result (`newTransactionsCount`/`categorizedCount`/`uncategorizedCount` on a mix of new/duplicate/categorisable-from-history/fallback transactions) and on the updated fields (`syncTimestamps` contains the new timestamp, `nextSyncEligibleAt` moved by 4h).
- New `app/api/gocardless/accounts/[accountId]/sync/route.test.ts`: ownership (another user's account → 404), 429 when not eligible (no call to `syncAccountLink`/GoCardless), correct status→HTTP mapping.
- `lib/format.test.ts` (extended or new): `formatRelativeTime` for the min/hours/days/absolute-date-fallback thresholds.
- `buildSyncSummaryMessage`/`buildSyncErrorMessage`: pure tests for each status combination.
- UI components (`AccountRow`, `ContiPage`) not unit tested, in line with the convention already followed in the project — manual verification by the user (no Postgres/Redis in the agent sandbox).

## Out of scope (explicitly excluded)

- Manual sync for connections with several accounts in a single click ("sync all") — explicitly requested per single account.
- History/log of past synchronisations beyond the last timestamp shown — only "last sync" and today's remaining count, no detailed history.
- Changing the cadence of the automatic scheduler (stays a cron every 12h) — only the minimum gap and the shared cap change.
- Automatic retry or smart backoff on the real GoCardless rate limit — the existing behaviour (silent skip on the scheduler side, error message on the manual side) is not extended.
