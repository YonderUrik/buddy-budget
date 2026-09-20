import { describe, expect, it } from "vitest";
import { applyCategorizationSchema, createRuleSchema, updateRuleSchema } from "./categorization-rules";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("applyCategorizationSchema", () => {
  it("accetta un gruppo valido e applica i default", () => {
    const parsed = applyCategorizationSchema.parse({
      groups: [{ transactionIds: [uuid], categoryId: uuid, merchantKey: "esselunga" }],
    });
    expect(parsed.groups[0].excludedPercentage).toBe(0);
    expect(parsed.groups[0].createRule).toBe(true);
  });

  it("rifiuta un gruppo senza transazioni", () => {
    expect(
      applyCategorizationSchema.safeParse({ groups: [{ transactionIds: [], categoryId: uuid, merchantKey: "x" }] }).success
    ).toBe(false);
  });

  it("rifiuta una quota esclusa fuori dall'intervallo 0-1", () => {
    expect(
      applyCategorizationSchema.safeParse({
        groups: [{ transactionIds: [uuid], categoryId: uuid, merchantKey: "x", excludedPercentage: 1.5 }],
      }).success
    ).toBe(false);
  });

  it("rifiuta una lista di gruppi vuota", () => {
    expect(applyCategorizationSchema.safeParse({ groups: [] }).success).toBe(false);
  });
});

describe("createRuleSchema", () => {
  it("accetta una regola contains senza split", () => {
    expect(createRuleSchema.parse({ matchType: "contains", pattern: "esselunga", categoryId: uuid }).pattern).toBe("esselunga");
  });

  it("rifiuta un matchType sconosciuto", () => {
    expect(createRuleSchema.safeParse({ matchType: "regex", pattern: "x", categoryId: uuid }).success).toBe(false);
  });
});

describe("updateRuleSchema", () => {
  it("rifiuta un aggiornamento vuoto", () => {
    expect(updateRuleSchema.safeParse({}).success).toBe(false);
  });
});
