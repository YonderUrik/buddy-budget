import { describe, expect, it } from "vitest";
import type { Debt } from "@/lib/db/schema/debts";
import { MIN_BAR_WIDTH_PCT, buildDebtTimeline } from "./timeline";
import { buildDebtsView } from "./view";

const now = new Date("2026-09-30T10:00:00Z");
function debt(overrides: Partial<Debt>): Debt {
  return {
    id: "d1", userId: "u", kind: "loan", name: "Prestito", startMode: "fotografia", principal: "5000.00", annualRate: "5.0000",
    installments: 12, firstInstallmentDate: "2026-10-05", installment: null, anchorDate: "2026-09-30", costs: [], creditLimit: null, spread: null, indexLabel: null, interestFrequency: null, dayCount: null, capitalizeInterest: null, alertThresholdType: null, alertThresholdValue: null, createdAt: now, updatedAt: now,
    ...overrides,
  };
}
const timeline = (debts: Debt[]) => buildDebtTimeline(buildDebtsView(debts, [], "2026-09-30").debts, "2026-09-30");

describe("buildDebtTimeline", () => {
  it("senza debiti aperti non c'è linea del tempo", () => {
    expect(timeline([])).toBeNull();
    expect(buildDebtTimeline(buildDebtsView([debt({})], [], "2030-01-01").debts, "2030-01-01")).toBeNull();
  });
  it("il debito più lungo occupa tutta la linea e gli altri finiscono prima", () => {
    const t = timeline([debt({ id: "a", installments: 12 }), debt({ id: "b", installments: 60 })])!;
    const long = t.bars.find((b) => b.debtId === "b")!;
    const short = t.bars.find((b) => b.debtId === "a")!;
    expect(long.startPct + long.widthPct).toBeCloseTo(100, 0);
    expect(short.startPct + short.widthPct).toBeLessThan(30);
    expect(t.bars.map((b) => b.debtId)).toEqual(["a", "b"]);
  });
  it("un debito che parte più avanti comincia dopo l'inizio della linea", () => {
    const t = timeline([debt({ id: "a", installments: 60 }), debt({ id: "b", startMode: "nuovo", firstInstallmentDate: "2027-09-10", installments: 24 })])!;
    expect(t.bars.find((b) => b.debtId === "b")!.startPct).toBeGreaterThan(10);
    expect(t.bars.find((b) => b.debtId === "a")!.startPct).toBeLessThan(1);
  });
  it("una barra molto corta resta visibile", () => {
    const t = timeline([debt({ id: "a", installments: 1 }), debt({ id: "b", installments: 120 })])!;
    expect(t.bars.find((b) => b.debtId === "a")!.widthPct).toBeGreaterThanOrEqual(MIN_BAR_WIDTH_PCT);
  });
  it("i segni dell'asse stanno dentro la linea", () => {
    const t = timeline([debt({ installments: 120 })])!;
    expect(t.ticks.length).toBeGreaterThan(3);
    expect(t.ticks.every((k) => k.pct > 0 && k.pct < 100)).toBe(true);
  });
});
