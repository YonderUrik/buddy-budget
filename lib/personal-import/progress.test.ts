import { describe, expect, it } from "vitest";
import { analysisProgress } from "./progress";

const report = (...steps: number[]) => ({ phase: "parse" as const, reason: "x", fallback: true, attempts: steps.map(step => ({ step, model: "m", reason: "unrecognized_rows" as const })) });

describe("progress of an analysis", () => {
  it("is the saved parser while it has not been rejected", () => {
    expect(analysisProgress({ status: "processing", parserId: "p", failureReport: null })).toEqual({ kind: "saved" });
  });
  it("is the next model attempt after the rejections recorded", () => {
    expect(analysisProgress({ status: "processing", parserId: null, failureReport: null })).toEqual({ kind: "model", attempt: 1, of: 3 });
    expect(analysisProgress({ status: "processing", parserId: "p", failureReport: report(0) })).toEqual({ kind: "model", attempt: 1, of: 3 });
    expect(analysisProgress({ status: "processing", parserId: null, failureReport: report(1, 2) })).toEqual({ kind: "model", attempt: 3, of: 3 });
  });
  it("is nothing outside the analysis", () => {
    expect(analysisProgress({ status: "queued", parserId: null, failureReport: null })).toBeNull();
    expect(analysisProgress({ status: "ready", parserId: "p", failureReport: report(1) })).toBeNull();
  });
});
