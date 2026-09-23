import {
  FINAL_PHASES,
  SYNC_JOB_STALE_MS,
  deriveJobStatus,
  type SyncJob,
  type SyncJobView,
} from "./types";

export type OverallProgress =
  | { kind: "complete" }
  | { kind: "determinate"; processed: number; total: number }
  | { kind: "indeterminate" };

/** Prepara un job per il client: un job running senza heartbeat da oltre 60s è mostrato come interrotto. */
export function toJobView(job: SyncJob, now: Date): SyncJobView {
  const isStale = job.status === "running" && now.getTime() - Date.parse(job.updatedAt) > SYNC_JOB_STALE_MS;
  if (!isStale) return { ...job, interrupted: false };

  const accounts = job.accounts.map((account) =>
    FINAL_PHASES.has(account.phase) ? account : { ...account, phase: "error" as const }
  );
  return {
    ...job,
    accounts,
    status: accounts.length === 0 ? "failed" : deriveJobStatus(accounts),
    interrupted: true,
  };
}

/** Avanzamento complessivo: determinato solo quando ogni conto ancora attivo conosce il proprio totale. */
export function overallProgress(job: SyncJob): OverallProgress {
  if (job.status !== "running") return { kind: "complete" };

  let processed = 0;
  let total = 0;
  for (const account of job.accounts) {
    if (account.total === null) {
      if (FINAL_PHASES.has(account.phase)) continue;
      return { kind: "indeterminate" };
    }
    processed += account.processed;
    total += account.total;
  }
  if (total === 0) return { kind: "indeterminate" };
  return { kind: "determinate", processed, total };
}

/** True se il conto sta sincronizzando in un job ancora in corso. */
export function isAccountSyncing(jobs: SyncJob[], accountId: string): boolean {
  return jobs.some(
    (job) =>
      job.status === "running" &&
      job.accounts.some((account) => account.accountId === accountId && !FINAL_PHASES.has(account.phase))
  );
}

/** Id dei job ancora in corso, per confrontare due poll successivi. */
export function runningJobIds(jobs: SyncJob[] | undefined): Set<string> {
  return new Set((jobs ?? []).filter((job) => job.status === "running").map((job) => job.id));
}

/** True se almeno un job che era in corso al poll precedente ora non lo è più. */
export function hasFinishedSince(previous: Set<string>, current: Set<string>): boolean {
  for (const id of previous) {
    if (!current.has(id)) return true;
  }
  return false;
}
