/** Server-reported progress for the latest manual AI categorization run. No transaction text is stored. */
export interface GenerationJob {
  id: string;
  status: "running" | "done" | "failed";
  processed: number;
  total: number;
  stored: number;
  blocked: number;
  startedAt: number;
  updatedAt: number;
}

/** A missing heartbeat means the background callback was interrupted. */
export const GENERATION_STALE_MS = 90_000;
export const GENERATION_MAX_MS = 300_000;
export const GENERATION_TTL_SECONDS = 24 * 60 * 60;

/** Treat abandoned work as failed so the button can be retried after a pod restart. */
export function generationView(job: GenerationJob | null, now = Date.now()): GenerationJob | null {
  return job?.status === "running" && (now - job.updatedAt > GENERATION_STALE_MS || now - job.startedAt > GENERATION_MAX_MS) ? { ...job, status: "failed" } : job;
}
