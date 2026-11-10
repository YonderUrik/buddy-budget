import { describe, expect, it } from "vitest";
import { hasNewlyFinishedImport, hasRunningImport, importStatuses, islandJobs, islandState } from "./island";

const job = (id: string, status: string, createdAt: string) => ({ id, status, createdAt, formatId: "f", estimatedAt: "", expiresAt: "", error: null, notifiedAt: null, results: null });
const NOW = Date.parse("2026-10-11T12:00:00Z");

describe("islandState", () => {
  it("raggruppa gli stati del lavoro", () => {
    expect(islandState({ status: "queued" })).toBe("running");
    expect(islandState({ status: "ready" })).toBe("running");
    expect(islandState({ status: "imported" })).toBe("done");
    expect(islandState({ status: "review_failed" })).toBeNull();
    expect(islandState({ status: "expired" })).toBeNull();
  });
});

describe("islandJobs", () => {
  const jobs = [job("a", "imported", "2026-10-11T10:00:00Z"), job("b", "processing", "2026-10-11T11:00:00Z"), job("c", "imported", "2026-10-09T10:00:00Z"), job("d", "expired", "2026-10-11T09:00:00Z")];
  it("tiene i recenti non chiusi, i più nuovi prima", () => {
    expect(islandJobs(jobs, new Set(), NOW).map((j) => j.id)).toEqual(["b", "a"]);
    expect(islandJobs(jobs, new Set(["b"]), NOW).map((j) => j.id)).toEqual(["a"]);
  });
  it("rileva i lavori in corso", () => {
    expect(hasRunningImport(jobs)).toBe(true);
    expect(hasRunningImport([jobs[0]])).toBe(false);
  });
});

describe("hasNewlyFinishedImport", () => {
  const at = "2026-10-11T10:00:00Z";
  it("spots an import that stopped running or was imported from review", () => {
    expect(hasNewlyFinishedImport(importStatuses([job("a", "processing", at)]), [job("a", "imported", at)])).toBe(true);
    expect(hasNewlyFinishedImport(importStatuses([job("a", "ready", at)]), [job("a", "failed", at)])).toBe(true);
    expect(hasNewlyFinishedImport(importStatuses([job("a", "failed", at)]), [job("a", "imported", at)])).toBe(true);
  });
  it("ignores unchanged, new or still running imports", () => {
    expect(hasNewlyFinishedImport(importStatuses([job("a", "imported", at)]), [job("a", "imported", at)])).toBe(false);
    expect(hasNewlyFinishedImport(new Map(), [job("a", "imported", at)])).toBe(false);
    expect(hasNewlyFinishedImport(importStatuses([job("a", "queued", at)]), [job("a", "processing", at)])).toBe(false);
  });
});
