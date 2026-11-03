import { describe, expect, it } from "vitest";
import { buildGroupFlow, buildMoneyFlow, type FlowGroup } from "./money-flow";

const sources = [
  { id: "stipendio", name: "Stipendio", amount: 2480 },
  { id: "altro", name: "Altre entrate", amount: 420 },
];
const groups: FlowGroup[] = [
  {
    key: "dovuta",
    label: "Dovute",
    color: "var(--group-dovuta)",
    amount: 1360,
    categories: [
      { id: "casa", name: "Casa", amount: 740 },
      { id: "spesa", name: "Spesa", amount: 340 },
      { id: "trasporti", name: "Trasporti", amount: 160 },
      { id: "bollette", name: "Bollette", amount: 107 },
      { id: "salute", name: "Salute", amount: 13 },
    ],
  },
  { key: "daCategorizzare", label: "Da categorizzare", color: "var(--group-uncategorized)", amount: 180, categories: [{ id: "fallback", name: "Da categorizzare", amount: 180 }] },
];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("buildMoneyFlow", () => {
  it("sends income to the groups and the rest to «Messo da parte»", () => {
    const flow = buildMoneyFlow(sources, groups);
    expect(flow.saved).toBe(1360);
    const fromIncome = flow.links.filter((l) => l.source === "income");
    expect(sum(fromIncome.map((l) => l.value))).toBe(2900);
    expect(flow.nodes.find((n) => n.id === "saved")?.value).toBe(1360);
  });

  it("folds categories under 3% of the income, and carries uncategorised through without naming it twice", () => {
    const flow = buildMoneyFlow(sources, groups);
    const categories = flow.nodes.filter((n) => n.kind === "category").map((n) => n.label);
    // 3% of 2900 = 87: Bollette (107) stays, Salute (13) is the single leftover and keeps its name.
    expect(categories).toEqual(["Casa", "Spesa", "Trasporti", "Bollette", "Salute", "Da categorizzare"]);
    expect(flow.nodes.find((n) => n.id === "group:daCategorizzare")?.hideLabel).toBe(true);
    expect(flow.nodes.find((n) => n.id === "category:pass:daCategorizzare")?.categoryId).toBeUndefined();
  });

  it("names folded categories «Altre …» with their count", () => {
    const flow = buildMoneyFlow(sources, groups, { categoriesPerGroup: 2 });
    const other = flow.nodes.find((n) => n.id === "category:other:dovuta");
    expect(other).toMatchObject({ label: "Altre dovute", value: 280, folded: 3 });
  });

  it("adds «Presi dai risparmi» when spending exceeds income", () => {
    const flow = buildMoneyFlow([{ id: "s", name: "Stipendio", amount: 1000 }], groups);
    expect(flow.saved).toBe(-540);
    expect(flow.nodes.find((n) => n.id === "savings")?.value).toBe(540);
    expect(flow.nodes.find((n) => n.id === "income")?.value).toBe(1540);
    expect(flow.nodes.some((n) => n.kind === "saved")).toBe(false);
  });

  it("without sources, splits each group between income and savings in proportion", () => {
    const flow = buildMoneyFlow([{ id: "s", name: "Stipendio", amount: 1000 }], groups, { withSources: false, withCategories: false });
    expect(flow.nodes.find((n) => n.id === "income")?.value).toBe(1000);
    const intoDovute = flow.links.filter((l) => l.target === "group:dovuta");
    expect(sum(intoDovute.map((l) => l.value))).toBeCloseTo(1360);
    expect(intoDovute.find((l) => l.source === "savings")?.value).toBeCloseTo((1360 * 540) / 1540);
    expect(flow.nodes.every((n) => n.kind !== "category")).toBe(true);
  });
});

describe("buildGroupFlow", () => {
  it("shows every category of the group", () => {
    const flow = buildGroupFlow(groups[0]);
    expect(flow.nodes.filter((n) => n.level === 1).map((n) => n.categoryId)).toEqual(["casa", "spesa", "trasporti", "bollette", "salute"]);
  });
});
