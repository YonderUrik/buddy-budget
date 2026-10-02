import { describe, expect, it } from "vitest";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import { buildAttentionRows } from "./attention-card.utils";

function group(key: string, ids: string[], suggested: string | null): SuggestionGroup {
  return {
    groupKey: key,
    merchantKey: key,
    label: key,
    transactionIds: ids,
    transactionDescriptions: ids.map(() => key),
    totalAmount: -10,
    suggestion: suggested
      ? {
          transactionId: ids[0],
          merchantKey: key,
          suggestedCategoryId: suggested,
          source: "regola",
          confidence: 1,
          reason: "",
          suggestedSplitPercentage: null,
        }
      : null,
    hasDivergentSuggestions: false,
  };
}

describe("buildAttentionRows", () => {
  const groups = [group("a", ["1"], null), group("b", ["2"], "cat"), group("c", ["3", "4"], null), group("d", ["5"], "cat")];

  it("mette prima i gruppi con proposta, poi le nuove, e rispetta il limite", () => {
    const rows = buildAttentionRows(groups, new Set(["5"]), 3);
    expect(rows.map((r) => r.groupKey)).toEqual(["d", "b", "a"]);
  });

  it("segna come nuovo un gruppo con almeno una transazione nuova", () => {
    const rows = buildAttentionRows(groups, new Set(["4"]), 4);
    expect(rows.find((r) => r.groupKey === "c")).toMatchObject({ isNew: true, transactionCount: 2 });
    expect(rows.find((r) => r.groupKey === "a")?.isNew).toBe(false);
  });

  it("non fallisce senza gruppi", () => {
    expect(buildAttentionRows([], new Set())).toEqual([]);
  });
});
