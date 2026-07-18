import { describe, expect, it } from "vitest";
import { upsertBudgetSchema } from "./budgets";

describe("upsertBudgetSchema", () => {
  it("accetta un importo mensile non negativo", () => {
    expect(upsertBudgetSchema.safeParse({ monthlyAmount: 300 }).success).toBe(true);
    expect(upsertBudgetSchema.safeParse({ monthlyAmount: 0 }).success).toBe(true);
  });

  it("rifiuta un importo negativo", () => {
    expect(upsertBudgetSchema.safeParse({ monthlyAmount: -10 }).success).toBe(false);
  });
});
