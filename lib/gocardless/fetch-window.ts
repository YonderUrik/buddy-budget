import type { RateLimitStore } from "./rate-limit";

/**
 * Days re-read before the last successful sync. Banks can publish a booked transaction days after its booking date
 * (card payments, weekends, transfers between banks), so the window always overlaps the previous one by a wide margin;
 * rows already saved are skipped by the `(accountId, externalId)` unique key.
 */
export const SYNC_OVERLAP_DAYS = 30;

/** At most this often an account still downloads its whole history, as a safety net for very late transactions. */
export const FULL_FETCH_INTERVAL_DAYS = 7;

const DAY_MS = 86_400_000;

/** Which transactions to ask GoCardless for: the whole history the bank exposes, or from a booking date on. */
export type FetchWindow = { mode: "full" } | { mode: "incremental"; dateFrom: string };

/** Redis key of the last full download of an account (epoch ms); it expires when a full download is due again. */
export function fullFetchKey(externalAccountId: string): string {
  return `gocardless:full-fetch:${externalAccountId}`;
}

/** First booking date an incremental sync reads, `SYNC_OVERLAP_DAYS` before the last successful sync (UTC day). */
export function incrementalDateFrom(lastSyncedAt: Date): string {
  return new Date(lastSyncedAt.getTime() - SYNC_OVERLAP_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Chooses the window: the whole history on the first sync, when the last full download is older than
 * `FULL_FETCH_INTERVAL_DAYS` (or unknown, e.g. Redis was emptied or unreachable), otherwise from `incrementalDateFrom`.
 * Every doubt resolves to a full download: it costs time, never a missing transaction.
 */
export async function planFetchWindow(
  store: RateLimitStore,
  externalAccountId: string,
  lastSyncedAt: Date | null
): Promise<FetchWindow> {
  if (!lastSyncedAt) return { mode: "full" };
  const lastFull = await store.get(fullFetchKey(externalAccountId)).catch(() => null);
  if (!lastFull) return { mode: "full" };
  return { mode: "incremental", dateFrom: incrementalDateFrom(lastSyncedAt) };
}

/** Remembers a completed full download until the next one is due. A write error only means the next sync is full too. */
export async function recordFullFetch(store: RateLimitStore, externalAccountId: string, now: Date): Promise<void> {
  await store
    .set(fullFetchKey(externalAccountId), String(now.getTime()), FULL_FETCH_INTERVAL_DAYS * 86_400)
    .catch(() => {});
}
