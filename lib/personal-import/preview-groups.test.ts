import { describe, expect, it } from "vitest";
import { defaultPreviewTab, groupPreviewRecords } from "./preview-groups";

const rec = (kind: string) => ({ key: kind, source: [], rate: null, outcome: { row: 0, kind } as never });

describe("groupPreviewRecords", () => {
  it("separa importabili, escluse ed errori e conta i tipi", () => {
    const g = groupPreviewRecords([rec("cash"), rec("cash"), rec("investment"), rec("ignore"), rec("error")]);
    expect([g.importable.length, g.ignored.length, g.errors.length, g.cash, g.investments]).toEqual([3, 1, 1, 2, 1]);
  });
  it("apre prima gli errori", () => {
    expect(defaultPreviewTab({ errors: [rec("error")] })).toBe("errors");
    expect(defaultPreviewTab({ errors: [] })).toBe("importable");
  });
});
