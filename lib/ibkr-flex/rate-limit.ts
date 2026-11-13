/**
 * IBKR's documented SendRequest limits: at most 1 request per second and 10 per minute (per token). Counted in fixed
 * windows on a shared store (Redis in production) so every pod and the cron see the same counters.
 */

export const SEND_REQUESTS_PER_SECOND = 1;
export const SEND_REQUESTS_PER_MINUTE = 10;
/** Past this wait the caller gives up with `rate_limited` instead of holding a request open. */
export const DEFAULT_MAX_RATE_WAIT_MS = 75_000;

/** Atomic counter with expiry: returns the value after incrementing. */
export interface RateWindowStore {
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export interface RateLimitDeps {
  store: RateWindowStore;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  maxWaitMs?: number;
}

export class RateLimitExceededError extends Error {
  constructor() { super("IBKR Flex rate limit wait exceeded"); this.name = "RateLimitExceededError"; }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wait until a SendRequest slot is free for `scope` (a hash of the token, never the token), then take it.
 * A refused attempt still counts in its window, which only makes the limiter more conservative.
 */
export async function acquireSendRequestSlot(scope: string, deps: RateLimitDeps): Promise<void> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const deadline = now() + (deps.maxWaitMs ?? DEFAULT_MAX_RATE_WAIT_MS);
  for (;;) {
    const at = now();
    const second = Math.floor(at / 1000);
    const minute = Math.floor(at / 60_000);
    let waitUntil: number | null = null;
    if (await deps.store.increment(`ibkr-flex:send:${scope}:s:${second}`, 2) > SEND_REQUESTS_PER_SECOND) waitUntil = (second + 1) * 1000;
    else if (await deps.store.increment(`ibkr-flex:send:${scope}:m:${minute}`, 61) > SEND_REQUESTS_PER_MINUTE) waitUntil = (minute + 1) * 60_000;
    if (waitUntil === null) return;
    if (waitUntil > deadline) throw new RateLimitExceededError();
    await sleep(Math.max(waitUntil - at, 1) + 25);
  }
}
