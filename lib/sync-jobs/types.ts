/** Tipo di lavoro che ha originato il job: import dopo "Conti trovati" o sync manuale di un conto. */
export type SyncJobKind = "initial-import" | "manual-sync";

export type SyncJobStatus = "running" | "done" | "failed";

export type SyncAccountPhase =
  | "queued"
  | "balance"
  | "fetching"
  | "saving"
  | "done"
  | "limited"
  | "expired"
  | "error";

/** Fasi dopo le quali un conto non cambia più stato. */
export const FINAL_PHASES: ReadonlySet<SyncAccountPhase> = new Set(["done", "limited", "expired", "error"]);

/** Durata di vita dello stato di un job su Redis. */
export const SYNC_JOB_TTL_SECONDS = 24 * 60 * 60;
/** Oltre questo intervallo senza aggiornamenti un job "running" è considerato interrotto. */
export const SYNC_JOB_STALE_MS = 60_000;
/** TTL del lock per conto: maxDuration delle route (300s) + margine. */
export const SYNC_LOCK_TTL_SECONDS = 360;

export interface SyncJobAccount {
  accountId: string;
  name: string;
  phase: SyncAccountPhase;
  /** Movimenti da elaborare: noto solo dopo lo scarico da GoCardless. */
  total: number | null;
  /** Movimenti elaborati (nuovi + già presenti). */
  processed: number;
  /** Movimenti nuovi davvero inseriti. */
  inserted: number;
  categorized: number;
  uncategorized: number;
  /** Motivo di un `error` noto in anticipo (conto già in sync altrove). */
  errorReason?: "already-running";
}

export type SyncJobAccountPatch = Partial<Omit<SyncJobAccount, "accountId" | "name">>;

export interface SyncJob {
  id: string;
  userId: string;
  kind: SyncJobKind;
  status: SyncJobStatus;
  dismissed: boolean;
  startedAt: string;
  /** Heartbeat: aggiornamento più recente tra metadati e conti. */
  updatedAt: string;
  accounts: SyncJobAccount[];
}

/** Job pronto per il client: `interrupted` indica un job rimasto senza heartbeat. */
export interface SyncJobView extends SyncJob {
  interrupted: boolean;
}

/** Conto appena aggiunto a un job, in attesa di partire. */
export function queuedAccount(accountId: string, name: string): SyncJobAccount {
  return { accountId, name, phase: "queued", total: null, processed: 0, inserted: 0, categorized: 0, uncategorized: 0 };
}

/** Stato del job derivato dai conti: running finché un conto non è finale, failed solo se tutti in errore. */
export function deriveJobStatus(accounts: SyncJobAccount[]): SyncJobStatus {
  if (accounts.length === 0) return "running";
  if (accounts.some((account) => !FINAL_PHASES.has(account.phase))) return "running";
  return accounts.every((account) => account.phase === "error") ? "failed" : "done";
}
