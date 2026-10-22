import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./suggest-for-user", () => ({ suggestCategoriesForUser: vi.fn(), MANUAL_RUN_BUDGET_MS: 240000, MAX_GROUPS_MANUAL_RUN: 600 }));
vi.mock("./generation-store", () => ({ writeGenerationJob: vi.fn() }));
vi.mock("../auto-apply", () => ({ autoApplyCategories: vi.fn() }));
import { suggestCategoriesForUser } from "./suggest-for-user";
import { writeGenerationJob } from "./generation-store";
import { autoApplyCategories } from "../auto-apply";
import { createLogger } from "@/lib/observability/logger";
import { runGeneration } from "./run-generation";
import type { GenerationJob } from "./generation";
const job: GenerationJob = { id: "job", status: "running", processed: 0, total: 0, stored: 0, blocked: 0, startedAt: Date.now(), updatedAt: Date.now() };
const log = createLogger({ write: () => {} });
beforeEach(() => { vi.resetAllMocks(); });
it("publishes completion when every merchant is privacy-blocked", async () => {
  vi.mocked(suggestCategoriesForUser).mockResolvedValue({ outcome: "nothing_to_do", stored: 0, blocked: 12 });
  await runGeneration("user", job, log);
  expect(writeGenerationJob).toHaveBeenLastCalledWith("user", expect.objectContaining({ status: "done", blocked: 12, stored: 0 }));
});
it("reports provider failure even after partial success", async () => {
  vi.mocked(suggestCategoriesForUser).mockImplementation(async (_user, options) => {
    await options!.onProgress!({ processed: 5, total: 12, stored: 5, blocked: 2 });
    return { outcome: "failed", stored: 5, blocked: 2 };
  });
  await runGeneration("user", job, log);
  expect(autoApplyCategories).toHaveBeenCalled();
  expect(writeGenerationJob).toHaveBeenLastCalledWith("user", expect.objectContaining({ status: "failed", stored: 5, processed: 5 }));
});
it("reports unexpected database or application errors instead of leaving running work", async () => {
  vi.mocked(suggestCategoriesForUser).mockRejectedValue(new Error("database unavailable"));
  await runGeneration("user", job, log);
  expect(writeGenerationJob).toHaveBeenLastCalledWith("user", expect.objectContaining({ status: "failed" }));
});
