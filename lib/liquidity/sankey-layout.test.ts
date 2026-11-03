import { describe, expect, it } from "vitest";
import type { MoneyFlow } from "./money-flow";
import { bandPath, layoutSankey } from "./sankey-layout";

const flow: MoneyFlow = {
  income: 100,
  spent: 60,
  saved: 40,
  nodes: [
    { id: "income", label: "Entrate", value: 100, color: "x", level: 0, kind: "income" },
    { id: "a", label: "A", value: 60, color: "x", level: 1, kind: "group" },
    { id: "saved", label: "Messo da parte", value: 40, color: "x", level: 1, kind: "saved" },
  ],
  links: [
    { source: "income", target: "a", value: 60, color: "x" },
    { source: "income", target: "saved", value: 40, color: "x" },
  ],
};

describe("layoutSankey", () => {
  it("scales nodes to the breadth and stacks bands in order", () => {
    const layout = layoutSankey(flow, { levelStarts: [0, 200], nodeThickness: 10, breadth: 110, gap: 10, minSize: 0 });
    const a = layout.nodes.find((n) => n.id === "a")!;
    const saved = layout.nodes.find((n) => n.id === "saved")!;
    // Level 1 needs one gap: (110 - 10) / 100 = 1 px per unit.
    expect(a.cross1 - a.cross0).toBeCloseTo(60);
    expect(saved.cross0).toBeCloseTo(70);
    expect(layout.used).toBeCloseTo(110);
    const [first, second] = layout.links;
    expect(first.source0).toBeCloseTo(0);
    expect(second.source0).toBeCloseTo(60);
    expect(second.target0).toBeCloseTo(70);
    expect(first.sourceMain).toBe(10);
    expect(first.targetMain).toBe(200);
  });

  it("keeps tiny nodes visible", () => {
    const tiny: MoneyFlow = { ...flow, nodes: flow.nodes.map((n) => (n.id === "saved" ? { ...n, value: 0.01 } : n)) };
    const layout = layoutSankey(tiny, { levelStarts: [0, 200], nodeThickness: 10, breadth: 110, gap: 10, minSize: 3 });
    const saved = layout.nodes.find((n) => n.id === "saved")!;
    expect(saved.cross1 - saved.cross0).toBeGreaterThanOrEqual(3);
  });

  it("draws bands in either orientation", () => {
    const [link] = layoutSankey(flow, { levelStarts: [0, 200], nodeThickness: 10, breadth: 110, gap: 10 }).links;
    expect(bandPath(link)).toMatch(/^M10,0 C/);
    expect(bandPath(link, true)).toMatch(/^M0,10 C/);
  });
});
