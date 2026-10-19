/** Quali importazioni personali mostra l'isola globale e in che stato: logica pura, senza React. */

import type { PersonalImportListing } from "@/lib/queries/personal-imports";

type Job = PersonalImportListing["jobs"][number];

export type IslandState = "running" | "done" | "failed";

/** Un'importazione resta visibile (se non chiusa) per un giorno dal caricamento. */
export const ISLAND_VISIBLE_MS = 24 * 60 * 60 * 1000;
export const ISLAND_DISMISSED_STORAGE_KEY = "bb-personal-import-dismissed";

const RUNNING = ["queued", "processing", "ready"];
const FAILED = ["failed", "review_failed"];

/** Stato mostrato dall'isola; `null` per i file scaduti, che non interessano più. */
export function islandState(job: Pick<Job, "status">): IslandState | null {
  if (RUNNING.includes(job.status)) return "running";
  if (job.status === "imported") return "done";
  if (FAILED.includes(job.status)) return "failed";
  return null;
}

/** Importazioni da mostrare: recenti, non chiuse, in uno stato noto; le più nuove prima. */
export function islandJobs(jobs: Job[] | undefined, dismissed: ReadonlySet<string>, now: number): Job[] {
  return (jobs ?? [])
    .filter((job) => islandState(job) !== null && !dismissed.has(job.id) && now - Date.parse(job.createdAt) < ISLAND_VISIBLE_MS)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** True se almeno un'importazione è in corso: serve a far girare il polling solo allora. */
export function hasRunningImport(jobs: Job[] | undefined): boolean {
  return (jobs ?? []).some((job) => islandState(job) === "running");
}


/** Status of each import as last seen, to spot the ones that just ended. */
export function importStatuses(jobs: Job[] | undefined): Map<string, string> {
  return new Map((jobs ?? []).map((job) => [job.id, job.status]));
}

/**
 * True when an import seen before has just ended: it was running and now is not, or it became `imported` from any
 * other status (a file imported from «Righe da controllare» never passes through the running states).
 */
export function hasNewlyFinishedImport(previous: ReadonlyMap<string, string>, jobs: Job[] | undefined): boolean {
  return (jobs ?? []).some((job) => {
    const before = previous.get(job.id);
    if (before === undefined || before === job.status) return false;
    return (islandState({ status: before }) === "running" && islandState(job) !== "running") || job.status === "imported";
  });
}
