import { describe, expect, it, vi } from "vitest";
import { analyzeWithFallback } from "./analysis";
import type { Outcome } from "./contract";
const parser = { kind: "javascript" as const, code: "function(){return []}" };
const saved = () => ({ parser, model: "saved" });
const table = { headers: ["raw"], rows: [["sample"]], delimiter: "" };
const rows: Outcome[] = [{ row: 0, kind: "cash", date: "2024-01-01", currency: "EUR", amount: 1, description: "Example", transfer: false }];
describe("automatic parser fallback", () => {
  it("reuses valid parsers without asking AI", async () => {
    const generate = vi.fn(), onFallback = vi.fn();
    const result = await analyzeWithFallback({ table, saved, generate, onFallback, execute: vi.fn().mockResolvedValue(rows) });
    expect(result.reused).toBe(true); expect(generate).not.toHaveBeenCalled(); expect(onFallback).not.toHaveBeenCalled();
  });
  it("durably retires an invalid parser before generation and validates the replacement twice", async () => {
    const order: string[] = [];
    const generate = vi.fn(async () => { order.push("generate"); return { parser, model: "new" }; });
    const onFallback = vi.fn(async () => { order.push("retire"); });
    const execute = vi.fn().mockRejectedValueOnce(Error("private data")).mockResolvedValue(rows);
    const result = await analyzeWithFallback({ table, saved, generate, onFallback, execute });
    expect(order).toEqual(["retire", "generate"]); expect(result.reused).toBe(false); expect(execute).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(onFallback.mock.calls)).not.toContain("private data");
  });
  it("regenerates parsers returning error outcomes and reports one-based row numbers", async () => {
    const onFallback = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn().mockResolvedValueOnce([{ row: 0, kind: "error", reason: "unknown" }]).mockResolvedValueOnce([{ row: 0, kind: "error", reason: "unknown" }]).mockResolvedValue(rows);
    await analyzeWithFallback({ table, saved, generate: async () => saved(), onFallback, execute });
    expect(onFallback).toHaveBeenCalledWith(expect.objectContaining({ rows: [1], count: 1, reason: "unrecognized_rows" }));
  });
  it("does not loop when AI also fails or start AI after a lost lease", async () => {
    const generate = vi.fn().mockRejectedValue(Error("AI unavailable"));
    const execute = vi.fn().mockRejectedValue(Error("broken"));
    await expect(analyzeWithFallback({ table, saved, generate, execute, onFallback: async () => {} })).rejects.toThrow("AI unavailable");
    expect(generate).toHaveBeenCalledTimes(1); generate.mockClear();
    await expect(analyzeWithFallback({ table, saved, generate, execute, onFallback: async () => { throw Error("lease lost"); } })).rejects.toThrow("lease lost");
    expect(generate).not.toHaveBeenCalled();
  });
});
