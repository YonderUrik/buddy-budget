import { autoApplyCategories } from "../auto-apply";
import { MANUAL_RUN_BUDGET_MS, MAX_GROUPS_MANUAL_RUN, suggestCategoriesForUser } from "./suggest-for-user";
import type { GenerationJob } from "./generation";
import { writeGenerationJob } from "./generation-store";
import type { Logger } from "@/lib/observability";

/** Runs in after(); publishes completion even when privacy rules leave nothing eligible. */
export async function runGeneration(userId: string, initial: GenerationJob, log: Logger): Promise<void> {
  let job = initial;
  const publish = async (patch: Partial<GenerationJob>) => {
    job = { ...job, ...patch };
    await writeGenerationJob(userId, job);
  };
  // The store rejects old IDs and terminal updates, including delayed heartbeats.
  const heartbeat = setInterval(() => {
    void writeGenerationJob(userId, job).catch((error) => log.warn("categorization.ai.heartbeat.failed", { error }));
  }, 15_000);
  try {
    const result = await suggestCategoriesForUser(userId, {
      log, maxGroups: MAX_GROUPS_MANUAL_RUN, budgetMs: MANUAL_RUN_BUDGET_MS,
      onProgress: (progress) => publish(progress),
    });
    await autoApplyCategories(userId, { log });
    await publish({ status: result.outcome === "failed" ? "failed" : "done", stored: result.stored, blocked: result.blocked });
    log.info("categorization.ai.generation.finished", { jobId: job.id, outcome: result.outcome, count: result.stored, rejected: result.blocked });
  } catch (error) {
    log.error("categorization.ai.generation.failed", { jobId: job.id, error });
    await publish({ status: "failed" });
  } finally {
    clearInterval(heartbeat);
  }
}
