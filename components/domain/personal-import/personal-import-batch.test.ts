import { describe, expect, it, vi } from "vitest";
import { addFiles, combineJobs, sendBatch, type BatchJob } from "./personal-import-batch";

const file = (name: string, csv = name) => ({ name, size: csv.length, csv });
const job = (id: string, status: string, results: BatchJob["results"] = null): BatchJob => ({ id, formatId: "f", status, estimatedAt: "", expiresAt: "", createdAt: "", error: status === "failed" ? "x" : null, notifiedAt: null, results });

describe("several files in one upload", () => {
  it("drops the same file chosen twice and anything past the limit", () => {
    const { files, dropped } = addFiles([file("a.csv")], [file("a.csv"), file("b.csv"), file("c.csv")], 2);
    expect(files.map(f => f.name)).toEqual(["a.csv", "b.csv"]); expect(dropped).toBe(1);
  });

  it("sends every file to the bank the first one created, and keeps going after a refusal", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ id: "j1", formatId: "new-bank" })
      .mockRejectedValueOnce(Object.assign(new Error("già importato"), { already: true }))
      .mockRejectedValueOnce(new Error("Limite raggiunto"))
      .mockResolvedValueOnce({ id: "j4", formatId: "new-bank" });
    const result = await sendBatch([file("1"), file("2"), file("3"), file("4")], undefined, send, e => !!(e as { already?: boolean }).already);
    expect(send.mock.calls.map(c => c[1])).toEqual([undefined, "new-bank", "new-bank", "new-bank"]);
    expect(result.queued.map(q => q.id)).toEqual(["j1", "j4"]);
    expect(result.alreadyImported.map(f => f.name)).toEqual(["2"]);
    expect(result.failed).toEqual([{ file: file("3"), message: "Limite raggiunto" }]);
  });

  it("an existing bank is used for every file", async () => {
    const send = vi.fn().mockResolvedValue({ id: "j", formatId: "other" });
    await sendBatch([file("1"), file("2")], "intesa", send, () => false);
    expect(send.mock.calls.map(c => c[1])).toEqual(["intesa", "intesa"]);
  });
});

describe("the receipt of a batch", () => {
  const done = (cash: number, rows: number, alreadyPresent: number) => ({ cash, investments: 0, skipped: 0, bankCategorized: 0, rows, alreadyPresent });
  it("waits for the listing and stays running while any file is", () => {
    expect(combineJobs([job("a", "imported"), undefined]).job).toBeUndefined();
    expect(combineJobs([job("a", "imported", done(1, 1, 0)), job("b", "processing"), job("c", "queued")]).job?.status).toBe("queued");
  });
  it("sums the imported files and counts the ones that failed", () => {
    const { job: combined, failedFiles } = combineJobs([job("a", "imported", done(3, 4, 1)), job("b", "failed"), job("c", "imported", done(2, 2, 0))]);
    expect(combined).toMatchObject({ status: "imported", results: { cash: 5, rows: 6, alreadyPresent: 1 } }); expect(failedFiles).toBe(1);
  });
  it("fails only when no file was imported", () => {
    expect(combineJobs([job("a", "failed"), job("b", "expired")]).job?.status).toBe("failed");
  });
});
