import { describe, expect, it } from "vitest";
import { importCounts, importOverlap } from "./counts";

describe("import counts", () => {
  it("reads the counts of a ledger, nothing from an older one", () => {
    expect(importCounts({ rows: 5, alreadyPresent: 2 })).toEqual({ rows: 5, alreadyPresent: 2 });
    expect(importCounts({})).toEqual({});
    expect(importCounts(null)).toEqual({});
  });
  it("tells a file with nothing new from a partial overlap and a new file", () => {
    expect(importOverlap({ rows: 4, alreadyPresent: 4 })).toBe("nothing_new");
    expect(importOverlap({ rows: 4, alreadyPresent: 1 })).toBe("partial");
    expect(importOverlap({ rows: 4, alreadyPresent: 0 })).toBe("all_new");
    expect(importOverlap({ rows: 0, alreadyPresent: 0 })).toBe("all_new");
    expect(importOverlap({})).toBe("unknown");
  });
});
