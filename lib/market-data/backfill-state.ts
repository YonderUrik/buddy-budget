/** Stato del recupero dello storico di uno strumento (comune a tutti gli utenti che lo possiedono). */
export interface BackfillState {
  instrumentId: string;
  status: "running" | "done" | "failed";
  saved: number;
  total: number | null;
  /** Inizio dell'intervallo richiesto: due richieste dello stesso intervallo sono lo stesso lavoro. */
  fromKey: string;
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

/**
 * Pausa dopo un recupero completato. Entro questa finestra non se ne avvia un altro per lo stesso strumento:
 * l'aggiornamento giornaliero copre comunque gli ultimi giorni, e una fonte che non conosce un intervallo non va
 * richiesta a ripetizione. Un recupero davvero interrotto si riconosce dall'heartbeat, non da questa pausa.
 */
export const BACKFILL_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Operazioni chiave-valore minime: implementate da Redis in produzione e in memoria nei test. */
export interface BackfillKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /**
   * Scrive `value` solo se la chiave non esiste, in un'unica operazione: due richieste simultanee non possono
   * avviare lo stesso recupero. Restituisce true se la scrittura è andata a buon fine.
   */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;
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

  function isCoolingDown(state: BackfillState): boolean {
    return state.status === "done" && clock().getTime() - Date.parse(state.updatedAt) < BACKFILL_COOLDOWN_MS;
  }

  function start(instrumentId: string, fromKey: string): BackfillState {
    const now = clock().toISOString();
    return { instrumentId, status: "running", saved: 0, total: null, fromKey, startedAt: now, updatedAt: now };
  }

  return {
    /**
     * Segna l'inizio del recupero di `fromKey`; false se ce n'è già uno in corso e vivo, se ne è appena finito uno
     * (pausa) o se un'altra richiesta l'ha appena avviato. La prima scrittura tenta la chiave in una sola
     * operazione, quindi due richieste simultanee non partono entrambe; se la chiave c'era già ma era scaduta o
     * interrotta si sovrascrive, perché in quel caso il recupero non sta girando davvero.
     */
    async tryStart(instrumentId: string, fromKey: string): Promise<boolean> {
      const current = await read(instrumentId);
      if (current && ((current.status === "running" && !isStale(current)) || isCoolingDown(current))) return false;
      const state = start(instrumentId, fromKey);
      const claimed = await kv.setIfAbsent(key(instrumentId), JSON.stringify(state), BACKFILL_STATE_TTL_SECONDS);
      if (claimed) return true;
      const winner = await read(instrumentId);
      // Qualcuno ha scritto dopo la nostra lettura: se il suo tentativo è vivo, questo si ferma.
      if (winner && winner.status === "running" && !isStale(winner)) return false;
      await write(state);
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
        fromKey: current?.fromKey ?? "",
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
    async setIfAbsent(k, v) {
      if (data.has(k)) return false;
      data.set(k, v);
      return true;
    },
  };
}
