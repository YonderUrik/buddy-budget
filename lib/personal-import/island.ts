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

/** Id delle importazioni in corso. */
export function runningImportIds(jobs: Job[] | undefined): Set<string> {
  return new Set((jobs ?? []).filter((job) => islandState(job) === "running").map((job) => job.id));
}
