import { describe, expect, it } from "vitest";
import { addMonthsKey, buildGoalsPlan, isMonthKey, monthKeyAtLeast, monthsBetween, monthsToFire, type GoalPlanInput } from "./plan";

const TODAY = "2026-10-15";
const goal = (over: Partial<GoalPlanInput>): GoalPlanInput => ({ id: "g", kind: "viaggio", target: 4000, targetDate: null, monthly: 200, current: 0, achieved: false, ...over });

describe("date dei mesi", () => {
  it("conta i mesi interi e somma mesi a una data", () => {
    expect(monthsBetween("2026-10-15", "2027-06-01")).toBe(8);
    expect(addMonthsKey("2026-10-15", 3)).toBe("2027-01");
    expect(addMonthsKey("2026-12-01", 1)).toBe("2027-01");
  });

  it("recognises only complete month keys", () => {
    expect(isMonthKey("2027-05")).toBe(true);
    // What a browser without a month picker (Safari on Mac) passes while the user is still typing.
    for (const partial of ["", "2", "ott", "2027", "2027-", "2027-5", "2027-13", "2027-00", "2027-05-01"]) expect(isMonthKey(partial)).toBe(false);
  });

  it("builds a month key never before the minimum", () => {
    expect(monthKeyAtLeast(2028, 3, "2026-11")).toBe("2028-03");
    expect(monthKeyAtLeast(2026, 4, "2026-11")).toBe("2026-11");
  });
});

describe("buildGoalsPlan", () => {
  it("dà il risparmio agli obiettivi in ordine di priorità e misura quanto manca", () => {
    const plan = buildGoalsPlan({
      goals: [goal({ id: "a", monthly: 450, target: 8700, current: 6000, kind: "emergenza" }), goal({ id: "b", monthly: 325, current: 1400 }), goal({ id: "c", monthly: 525, target: 40000, current: 18500, kind: "casa" })],
      capacity: 1180,
      today: TODAY,
      fire: null,
    });
    expect(plan.requested).toBe(1300);
    expect(plan.allocated).toBe(1180);
    expect(plan.gap).toBe(120);
    expect(plan.rows.map((r) => r.funded)).toEqual([450, 325, 405]);
  });

  it("dice se si arriva in tempo e quanto servirebbe al mese", () => {
    const [late] = buildGoalsPlan({ goals: [goal({ current: 1400, targetDate: "2027-06-01" })], capacity: null, today: TODAY, fire: null }).rows;
    expect(late.status).toBe("in_ritardo");
    expect(late.monthsToGo).toBe(13);
    expect(late.etaMonth).toBe("2027-11");
    expect(late.required).toBe(325);
    const [ok] = buildGoalsPlan({ goals: [goal({ current: 1400, targetDate: "2027-06-01", monthly: 325 })], capacity: null, today: TODAY, fire: null }).rows;
    expect(ok.status).toBe("in_linea");
  });

  it("riconosce gli obiettivi raggiunti e quelli fermi", () => {
    const plan = buildGoalsPlan({ goals: [goal({ id: "a", current: 5000 }), goal({ id: "b", achieved: true }), goal({ id: "c", monthly: 0 })], capacity: 100, today: TODAY, fire: null });
    expect(plan.rows.map((r) => r.status)).toEqual(["raggiunto", "raggiunto", "fermo"]);
    expect(plan.rows[0].progress).toBe(1);
    expect(plan.requested).toBe(0);
  });

  it("senza risparmio non dà niente a nessuno", () => {
    const plan = buildGoalsPlan({ goals: [goal({})], capacity: -50, today: TODAY, fire: null });
    expect(plan.rows[0].status).toBe("fermo");
    expect(plan.gap).toBe(200);
  });

  it("sposta il traguardo solo per i soldi che escono dal patrimonio", () => {
    const fire = { wealth: 187000, annualSavings: 14200, realReturn: 0.04, target: 525700 };
    const plan = buildGoalsPlan({
      goals: [goal({ id: "em", kind: "emergenza", target: 8700, current: 6000, monthly: 450 }), goal({ id: "casa", kind: "casa", target: 40000, current: 18500, monthly: 525 })],
      capacity: 1180,
      today: TODAY,
      fire,
    });
    const base = monthsToFire(fire)!;
    expect(plan.fire?.baseMonths).toBe(base);
    expect(plan.rows[0].fireShiftMonths).toBe(0);
    expect(plan.rows[1].fireShiftMonths).toBeGreaterThan(12);
    expect(plan.fire!.withGoalsMonths! - base).toBe(plan.rows[1].fireShiftMonths);
  });
});
