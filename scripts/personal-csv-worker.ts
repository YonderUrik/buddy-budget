import { processOne, maintainJobs } from "@/lib/personal-import/worker";
import { logger } from "@/lib/observability";
let stopped = false;
process.on("SIGTERM", () => { stopped = true; });
process.on("SIGINT", () => { stopped = true; });
async function main() {
  logger.info("personal_import.worker_started");
  while (!stopped) {
    try { await maintainJobs(); if (await processOne()) continue; }
    catch { logger.error("personal_import.worker_failed", { reason: "iteration_failed" }); }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  process.exit(0);
}
void main();
