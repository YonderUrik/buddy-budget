/** State of the price history backfill of one instrument (shared by every user who holds it). */
export interface BackfillState {
  instrumentId: string;
  status: "running" | "done" | "failed";
  saved: number;
  total: number | null;
  /** Start of the requested interval: two requests for the same interval are the same piece of work. */
  fromKey: string;
  startedAt: string;
  updatedAt: string;
}

/** State for the client: `interrupted` marks a run left without a heartbeat (function died on timeout). */
export interface BackfillStateView extends BackfillState {
  interrupted: boolean;
}

/** How long the state lives on Redis. */
export const BACKFILL_STATE_TTL_SECONDS = 24 * 60 * 60;
/** Past this interval without an update a `running` backfill is treated as interrupted. */
export const BACKFILL_STALE_MS = 60_000;

/**
 * Pause after a completed run. Within this window another one is not started for the same interval: the daily
 * update covers the last days anyway, and a source that does not know an interval must not be asked again and
 * again. A run that really was interrupted is recognised by the heartbeat, not by this pause.
 */
export const BACKFILL_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Minimal key-value operations: Redis in production, in-memory in tests. */
export interface BackfillKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /**
   * Writes `value` only when the key does not exist, in a single operation: two simultaneous requests cannot
   * start the same backfill. Returns true when the write went through.
   */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;
}

function key(instrumentId: string): string {
  return `market:backfill:${instrumentId}`;
}

/** Backfill state with timestamps and the interruption check. */
export function createBackfillStore(kv: BackfillKv, clock: () => Date = () => new Date()) {
  async function read(instrumentId: string): Promise<BackfillState | null> {
    const raw = await kv.get(key(instrumentId));
    return raw ? (JSON.parse(raw) as BackfillState) : null;
  }

  async function write(state: BackfillState): Promise<void> {
    await kv.set(key(state.instrumentId), JSON.stringify(state), BACKFILL_STATE_TTL_SECONDS);
  }

  function isStale(state: BackfillState): boolean {
    return state.status === "running" && clock().getTime() - Date.parse(state.updatedAt) > BACKFILL_STALE_MS;
  }

  /**
   * True when a completed run already asked for an interval that starts at or before `fromKey`, so asking again
   * within the window would repeat work the source has just been asked for.
   *
   * `fromKey` is the reason for the check: a completed run only ever covers the interval it requested. Without it
   * a finished 30-day backfill would block a two-year-old operation entered right afterwards, which is the most
   * common flow there is. A state written before `fromKey` existed carries no interval and covers nothing.
   */
  function isCoolingDown(state: BackfillState, fromKey: string): boolean {
    return (
      state.status === "done" &&
      typeof state.fromKey === "string" &&
      state.fromKey !== "" &&
      state.fromKey <= fromKey &&
      clock().getTime() - Date.parse(state.updatedAt) < BACKFILL_COOLDOWN_MS
    );
  }

  function start(instrumentId: string, fromKey: string): BackfillState {
    const now = clock().toISOString();
    return { instrumentId, status: "running", saved: 0, total: null, fromKey, startedAt: now, updatedAt: now };
  }

  return {
    /**
     * Marks the start of the backfill of `fromKey`; false when a live run is already going, when a completed run
     * within the cooldown already covered this interval, or when another request has just started one. The first
     * write claims the key in a single operation, so two simultaneous requests cannot both start; if the key
     * existed but was expired or interrupted it is overwritten, because the run is not actually going.
     */
    async tryStart(instrumentId: string, fromKey: string): Promise<boolean> {
      const current = await read(instrumentId);
      if (current && ((current.status === "running" && !isStale(current)) || isCoolingDown(current, fromKey))) {
        return false;
      }
      const state = start(instrumentId, fromKey);
      const claimed = await kv.setIfAbsent(key(instrumentId), JSON.stringify(state), BACKFILL_STATE_TTL_SECONDS);
      if (claimed) return true;
      const winner = await read(instrumentId);
      // Someone wrote after our read: when their attempt is alive, this one stops.
      if (winner && winner.status === "running" && !isStale(winner)) return false;
      await write(state);
      return true;
    },
    /** Updates counters and the heartbeat. */
    async progress(instrumentId: string, saved: number, total: number): Promise<void> {
      const current = await read(instrumentId);
      if (!current) return;
      await write({ ...current, saved, total, updatedAt: clock().toISOString() });
    },
    async finish(instrumentId: string, status: "done" | "failed", saved: number): Promise<void> {
      const current = await read(instrumentId);
      const now = clock().toISOString();
      await write({
        instrumentId,
        status,
        saved,
        total: current?.total ?? saved,
        fromKey: current?.fromKey ?? "",
        startedAt: current?.startedAt ?? now,
        updatedAt: now,
      });
    },
    /** States of the requested instruments (those without a state do not appear). */
    async views(instrumentIds: string[]): Promise<BackfillStateView[]> {
      const states = await Promise.all(instrumentIds.map(read));
      return states.filter((s): s is BackfillState => s !== null).map((s) => ({ ...s, interrupted: isStale(s) }));
    },
  };
}

export type BackfillStore = ReturnType<typeof createBackfillStore>;

/** KV in memoria per i test. */
export function createMemoryBackfillKv(): BackfillKv {
  const data = new Map<string, string>();
  return {
    async get(k) {
      return data.get(k) ?? null;
    },
    async set(k, v) {
      data.set(k, v);
    },
    async setIfAbsent(k, v) {
      if (data.has(k)) return false;
      data.set(k, v);
      return true;
    },
  };
}
