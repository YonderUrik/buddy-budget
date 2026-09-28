/** Stato del recupero dello storico di uno strumento (comune a tutti gli utenti che lo possiedono). */
export interface BackfillState {
  instrumentId: string;
  status: "running" | "done" | "failed";
  saved: number;
  total: number | null;
  startedAt: string;
  updatedAt: string;
}

/** Stato per il client: `interrupted` indica un recupero rimasto senza heartbeat (funzione morta per timeout). */
export interface BackfillStateView extends BackfillState {
  interrupted: boolean;
}

/** Durata dello stato su Redis. */
export const BACKFILL_STATE_TTL_SECONDS = 24 * 60 * 60;
/** Oltre questo intervallo senza aggiornamenti un recupero "running" è considerato interrotto. */
export const BACKFILL_STALE_MS = 60_000;

/** Operazioni chiave-valore minime: implementate da Redis in produzione e in memoria nei test. */
export interface BackfillKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

function key(instrumentId: string): string {
  return `market:backfill:${instrumentId}`;
}

/** Stato del recupero con i timestamp e il controllo di interruzione. */
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

  return {
    /** Segna l'inizio del recupero; false se ce n'è già uno in corso e vivo (non si parte due volte). */
    async tryStart(instrumentId: string): Promise<boolean> {
      const current = await read(instrumentId);
      if (current && current.status === "running" && !isStale(current)) return false;
      const now = clock().toISOString();
      await write({ instrumentId, status: "running", saved: 0, total: null, startedAt: now, updatedAt: now });
      return true;
    },
    /** Aggiorna contatori e heartbeat. */
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
        startedAt: current?.startedAt ?? now,
        updatedAt: now,
      });
    },
    /** Stati degli strumenti richiesti (quelli senza stato non compaiono). */
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
  };
}
