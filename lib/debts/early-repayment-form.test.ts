import { describe, expect, it } from "vitest";
import { buildDebtsView } from "./view";
import { previewEarlyRepayment, resolvePenalty } from "./early-repayment-form";
import type { Debt } from "@/lib/db/schema/debts";

const now = new Date();
const debt: Debt = {
  id: "d1", userId: "u1", kind: "loan", name: "Auto", startMode: "nuovo", principal: "12000.00", annualRate: "6.0000", installments: 24,
  firstInstallmentDate: "2026-03-05", installment: null, anchorDate: null, costs: [], createdAt: now, updatedAt: now,
};
const view = buildDebtsView([debt], [], "2026-02-01").debts[0];
const values = { mode: "once" as const, date: "2026-08-10", amount: "3000", penalty: "", penaltyUnit: "eur" as const };

describe("resolvePenalty", () => {
  it("euro fissi o percentuale della somma", () => {
    expect(resolvePenalty(3000, "50", "eur")).toBe(50);
    expect(resolvePenalty(3000, "1", "percent")).toBe(30);
    expect(resolvePenalty(3000, "", "percent")).toBe(0);
    expect(resolvePenalty(3000, "abc", "eur")).toBeUndefined();
  });
});

describe("previewEarlyRepayment", () => {
  it("vuoto senza importo", () => expect(previewEarlyRepayment(view, "2026-02-01", { ...values, amount: "" }).kind).toBe("empty"));
  it("errore con data dopo la fine", () => expect(previewEarlyRepayment(view, "2026-02-01", { ...values, date: "2030-01-01" }).kind).toBe("error"));
  it("una tantum: confronto con penale in euro", () => {
    const p = previewEarlyRepayment(view, "2026-02-01", { ...values, penalty: "1", penaltyUnit: "percent" });
    expect(p.kind).toBe("once");
    if (p.kind === "once") {
      expect(p.penalty).toBe(30);
      expect(p.comparison.reduceDuration.netBenefit).toBeCloseTo(p.comparison.reduceDuration.interestSaved - 30, 2);
    }
  });
  it("mensile: simulazione dell'extra", () => {
    const p = previewEarlyRepayment(view, "2026-02-01", { ...values, mode: "monthly", amount: "100" });
    expect(p.kind).toBe("monthly");
  });
});
