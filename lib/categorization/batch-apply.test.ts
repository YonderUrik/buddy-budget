import { describe, expect, it } from "vitest";
import { CATEGORIZE_APPLY_BATCH_SIZE, chunkGroups } from "./batch-apply";

describe("chunkGroups", () => {
  it("restituisce un array vuoto per un input vuoto", () => {
    expect(chunkGroups([])).toEqual([]);
  });

  it("mette tutto in un unico blocco quando l'input è più piccolo della dimensione del blocco", () => {
    expect(chunkGroups([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
  });

  it("divide in blocchi esatti quando la lunghezza è multipla della dimensione del blocco", () => {
    expect(chunkGroups([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("l'ultimo blocco contiene il resto quando la lunghezza non è multipla", () => {
    expect(chunkGroups([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("usa CATEGORIZE_APPLY_BATCH_SIZE come default", () => {
    const groups = Array.from({ length: CATEGORIZE_APPLY_BATCH_SIZE + 1 }, (_, i) => i);
    expect(chunkGroups(groups)).toEqual([
      groups.slice(0, CATEGORIZE_APPLY_BATCH_SIZE),
      groups.slice(CATEGORIZE_APPLY_BATCH_SIZE),
    ]);
  });

  it("lancia un errore per batchSize non valido", () => {
    expect(() => chunkGroups([1, 2], 0)).toThrow();
  });
});
