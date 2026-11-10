import { describe, expect, it, vi } from "vitest";
import { LadderExhaustedError, runLadder, type GenerationRequest } from "./analysis";
import { readRawFile, type Outcome } from "./contract";
import { ModelInputError, ModelOutputError, TransientError } from "./errors";
const parser = { kind: "javascript" as const, code: "function(){return []}" };
const saved = () => ({ parser, model: "saved" });
const table = { headers: ["raw"], rows: [["sample"]], delimiter: "" };
const rows: Outcome[] = [{ row: 0, kind: "cash", date: "2024-01-01", currency: "EUR", amount: 1, description: "Example", transfer: false }];
const errorRow: Outcome[] = [{ row: 0, kind: "error", reason: "unknown" }];
const base = { table, model: "flash", onAttempt: async () => {} };

describe("recovery ladder", () => {
  it("reuses a saved parser that passes without asking AI", async () => {
    const generate = vi.fn(), onAttempt = vi.fn();
    const result = await runLadder({ ...base, saved, generate, onAttempt, execute: vi.fn().mockResolvedValue(rows) });
    expect(result).toMatchObject({ reused: true, step: 0 }); expect(generate).not.toHaveBeenCalled(); expect(onAttempt).not.toHaveBeenCalled();
  });

  it("records the saved parser's failure before generating, and passes it as reference", async () => {
    const order: string[] = [];
    const generate = vi.fn(async (request: GenerationRequest) => { order.push(`generate:${request.step}`); expect(request.reference?.parser).toEqual(parser); return { parser, model: "flash" }; });
    const onAttempt = vi.fn(async () => { order.push("record"); });
    const execute = vi.fn().mockRejectedValueOnce(Error("private data")).mockResolvedValue(rows);
    const result = await runLadder({ ...base, saved, generate, onAttempt, execute });
    expect(order).toEqual(["record", "generate:1"]); expect(result).toMatchObject({ reused: false, step: 1 });
    expect(JSON.stringify(onAttempt.mock.calls)).not.toContain("private data");
  });

  it("climbs Flash, Flash with the last rejection, then reasoning with 128k and every rejection", async () => {
    const requests: GenerationRequest[] = [];
    const execute = vi.fn().mockResolvedValueOnce(errorRow).mockResolvedValueOnce(errorRow).mockResolvedValueOnce(errorRow).mockResolvedValueOnce(errorRow).mockResolvedValue(rows);
    const result = await runLadder({ ...base, generate: async request => { requests.push(request); return { parser, model: "flash" }; }, execute });
    expect(result.step).toBe(3);
    expect(requests.map(r => [r.step, r.reasoning, r.maxTokens, r.feedback.length])).toEqual([[1, false, 32768, 0], [2, false, 32768, 1], [3, true, 131072, 2]]);
    expect(requests[1].feedback[0]).toMatchObject({ reason: "unrecognized_rows", lines: [{ row: 0, text: "sample" }], parser });
  });

  it("fails after the third step with every attempt, one-based rows for support", async () => {
    const onAttempt = vi.fn();
    const error = await runLadder({ ...base, saved, onAttempt, generate: async () => ({ parser, model: "flash" }), execute: vi.fn().mockResolvedValue(errorRow) }).catch(e => e);
    expect(error).toBeInstanceOf(LadderExhaustedError);
    expect((error as LadderExhaustedError).attempts.map(a => a.step)).toEqual([0, 1, 2, 3]);
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ step: 1, rows: [1], count: 1, reason: "unrecognized_rows" }));
  });

  it("an answer cut at the budget goes straight to the 128k step", async () => {
    const generate = vi.fn().mockRejectedValueOnce(new ModelOutputError("cut", true)).mockResolvedValue({ parser, model: "flash" });
    const result = await runLadder({ ...base, generate, execute: vi.fn().mockResolvedValue(rows) });
    expect(result.step).toBe(3); expect(generate.mock.calls.map(c => c[0].step)).toEqual([1, 3]);
  });

  it("an unusable answer climbs; a transient error or refused input stops without recording", async () => {
    const climbing = vi.fn().mockRejectedValueOnce(new ModelOutputError("not json")).mockResolvedValue({ parser, model: "flash" });
    expect((await runLadder({ ...base, generate: climbing, execute: vi.fn().mockResolvedValue(rows) })).step).toBe(2);
    for (const error of [new TransientError("down"), new ModelInputError("too big")]) {
      const onAttempt = vi.fn();
      await expect(runLadder({ ...base, onAttempt, generate: vi.fn().mockRejectedValue(error), execute: vi.fn() })).rejects.toBe(error);
      expect(onAttempt).not.toHaveBeenCalled();
    }
  });

  it("a sandbox outage is transient, not a wrong parser", async () => {
    await expect(runLadder({ ...base, saved, generate: vi.fn(), execute: vi.fn().mockRejectedValue(Error("Sandbox non disponibile")) })).rejects.toBeInstanceOf(TransientError);
  });

  it("resumes after a restart from the step after the last recorded one", async () => {
    const generate = vi.fn().mockResolvedValue({ parser, model: "flash" });
    const done = [{ step: 0, model: "saved", reason: "invalid_parser" as const }, { step: 1, model: "flash", reason: "unrecognized_rows" as const }];
    await runLadder({ ...base, saved, done, generate, execute: vi.fn().mockRejectedValueOnce(Error("x")).mockResolvedValue(rows) });
    expect(generate.mock.calls.map(c => c[0].step)).toEqual([2]);
  });

  it("stops when the job is no longer ours", async () => {
    const generate = vi.fn();
    await expect(runLadder({ ...base, saved, generate, onAttempt: async () => { throw Error("lease lost"); }, execute: vi.fn().mockRejectedValue(Error("broken")) })).rejects.toThrow("lease lost");
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects a parser whose metadata leaves a header column undeclared", async () => {
    const file = readRawFile("Data;Descrizione;Importo;Saldo\n2024-01-02;Bar;-1,50;10\n");
    const cash: Outcome[] = [{ row: 0, kind: "ignore", reason: "intestazione" }, { row: 1, kind: "cash", date: "2024-01-02", currency: "EUR", amount: -1.5, description: "Bar", transfer: false }];
    const metadata = { version: 1 as const, institution: { name: null, evidence: "unknown" as const }, delimiter: ";" as const, columns: [{ section: null, index: 0, name: "Data", mapsTo: ["date" as const] }, { section: null, index: 1, name: "Descrizione", mapsTo: ["description" as const] }, { section: null, index: 2, name: "Importo", mapsTo: ["amount" as const] }] };
    const partial = { kind: "javascript" as const, code: "x", metadata };
    const complete = { ...partial, metadata: { ...metadata, columns: [...metadata.columns, { section: null, index: 3, name: "Saldo", mapsTo: [] }] } };
    const requests: GenerationRequest[] = [];
    const generate = vi.fn().mockImplementationOnce(async (r: GenerationRequest) => { requests.push(r); return { parser: partial, model: "flash" }; }).mockImplementation(async (r: GenerationRequest) => { requests.push(r); return { parser: complete, model: "flash" }; });
    const result = await runLadder({ ...base, table: file, generate, execute: vi.fn().mockResolvedValue(cash) });
    expect(result.step).toBe(2);
    expect(requests[1].feedback[0]).toMatchObject({ reason: "undeclared_columns", columns: [{ index: 3, name: "Saldo" }] });
  });
});
