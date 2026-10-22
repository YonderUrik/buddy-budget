import { describe, expect, it } from "vitest";
import { generationView, GENERATION_STALE_MS, GENERATION_MAX_MS, type GenerationJob } from "./generation";
const job: GenerationJob = { id: "job", status: "running", processed: 0, total: 0, stored: 0, blocked: 12, startedAt: 1000, updatedAt: 1000 };
describe("generationView", () => {
  it("does not infer running work from zero suggestions", () => {
    expect(generationView({ ...job, status: "done" }, 5000)?.status).toBe("done");
    expect(generationView(null)).toBeNull();
  });
  it("marks a lost heartbeat as interrupted and preserves partial results", () => {
    expect(generationView({ ...job, stored: 5 }, 1001 + GENERATION_STALE_MS)).toMatchObject({ status: "failed", stored: 5 });
  });
  it("bounds live work even if heartbeats continue", () => {
    const now = job.startedAt + GENERATION_MAX_MS + 1;
    expect(generationView({ ...job, updatedAt: now }, now)?.status).toBe("failed");
    expect(generationView(job, 2000)?.status).toBe("running");
  });
});
