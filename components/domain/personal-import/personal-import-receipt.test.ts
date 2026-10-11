import { describe, expect, it } from "vitest";
import { countCsvRows } from "./personal-import-upload";
import { receiptStage } from "./personal-import-receipt";

describe("countCsvRows", () => {
  it("esclude intestazione e righe vuote", () => {
    expect(countCsvRows("a,b\n1,2\n\n3,4\r\n")).toBe(2);
    expect(countCsvRows("")).toBe(0);
  });
});

describe("receiptStage", () => {
  it("segue lo stato del lavoro", () => {
    expect(receiptStage(undefined)).toBe(1);
    expect(receiptStage("processing")).toBe(1);
    expect(receiptStage("ready")).toBe(2);
    expect(receiptStage("imported")).toBe(4);
  });
});
