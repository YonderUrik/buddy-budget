import type { AnalysisFailure } from "./analysis";

/** Which read of the file is running: the saved parser, or model attempt 1–3 of the ladder. */
export type AnalysisProgress = { kind: "saved" } | { kind: "model"; attempt: number; of: number };
const MODEL_ATTEMPTS = 3;

/**
 * Progress of a job in analysis, from what the job already stores: a saved parser not yet rejected is being tried;
 * otherwise the next model attempt after the rejections recorded. Null outside `processing`. Pure.
 */
export function analysisProgress(job: { status: string; parserId: string | null; failureReport: AnalysisFailure | null }): AnalysisProgress | null {
  if (job.status !== "processing") return null;
  const attempts = job.failureReport?.attempts ?? [];
  if (job.parserId && !attempts.some(a => a.step === 0)) return { kind: "saved" };
  const last = Math.max(0, ...attempts.map(a => a.step));
  return { kind: "model", attempt: Math.min(last + 1, MODEL_ATTEMPTS), of: MODEL_ATTEMPTS };
}
