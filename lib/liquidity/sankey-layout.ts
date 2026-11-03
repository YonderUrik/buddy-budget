/**
 * Minimal Sankey layout (no library): nodes stacked per level along the cross axis with one shared scale, links as
 * bands whose thickness is their value. Orientation-free: `main` is the axis the money flows along, `cross` the
 * other one; the renderer maps them to x/y (horizontal) or y/x (vertical).
 */

import type { MoneyFlow, MoneyFlowLink, MoneyFlowNode } from "./money-flow";

export interface SankeyLayoutOptions {
  /** Start of each level on the main axis (px). */
  levelStarts: readonly number[];
  /** Thickness of a node along the main axis (px). */
  nodeThickness: number;
  /** Space available on the cross axis (px). */
  breadth: number;
  /** Space between two nodes of the same level (px). */
  gap: number;
  /** Smallest size of a node on the cross axis, so a tiny amount still shows. */
  minSize?: number;
}

export interface PlacedNode extends MoneyFlowNode {
  main0: number;
  main1: number;
  cross0: number;
  cross1: number;
}

export interface PlacedLink extends MoneyFlowLink {
  sourceMain: number;
  targetMain: number;
  /** Cross-axis span of the band where it leaves the source and where it reaches the target. */
  source0: number;
  source1: number;
  target0: number;
  target1: number;
}

export interface SankeyLayout {
  nodes: PlacedNode[];
  links: PlacedLink[];
  /** Cross-axis extent actually used (px). */
  used: number;
}

/** Places the nodes and links of a flow. */
export function layoutSankey(flow: MoneyFlow, options: SankeyLayoutOptions): SankeyLayout {
  const { levelStarts, nodeThickness, breadth, gap, minSize = 2 } = options;
  const levels = new Map<number, MoneyFlowNode[]>();
  for (const n of flow.nodes) levels.set(n.level, [...(levels.get(n.level) ?? []), n]);
  let scale = Infinity;
  for (const nodes of levels.values()) {
    const total = nodes.reduce((sum, n) => sum + n.value, 0);
    if (total > 0) scale = Math.min(scale, (breadth - gap * (nodes.length - 1) - minSize * nodes.length) / total);
  }
  if (!Number.isFinite(scale) || scale <= 0) scale = 0;

  const placed = new Map<string, PlacedNode>();
  let used = 0;
  for (const [level, nodes] of levels) {
    let cursor = 0;
    const main0 = levelStarts[level] ?? 0;
    for (const n of nodes) {
      const size = Math.max(n.value * scale, minSize);
      placed.set(n.id, { ...n, main0, main1: main0 + nodeThickness, cross0: cursor, cross1: cursor + size });
      cursor += size + gap;
    }
    used = Math.max(used, cursor - gap);
  }

  const order = (id: string) => placed.get(id)?.cross0 ?? 0;
  const outOffset = new Map<string, number>();
  const inOffset = new Map<string, number>();
  const sorted = [...flow.links].sort((a, b) => order(a.source) - order(b.source) || order(a.target) - order(b.target));
  const links: PlacedLink[] = [];
  for (const l of sorted) {
    const s = placed.get(l.source);
    const t = placed.get(l.target);
    if (!s || !t) continue;
    const thickness = Math.max(l.value * scale, Math.min(minSize, 1));
    const so = outOffset.get(s.id) ?? s.cross0;
    const to = inOffset.get(t.id) ?? t.cross0;
    outOffset.set(s.id, so + thickness);
    inOffset.set(t.id, to + thickness);
    links.push({ ...l, sourceMain: s.main1, targetMain: t.main0, source0: so, source1: so + thickness, target0: to, target1: to + thickness });
  }
  return { nodes: [...placed.values()], links, used };
}

/** SVG path of a band; `vertical` swaps the axes (money flowing top to bottom). */
export function bandPath(link: PlacedLink, vertical = false): string {
  const m = (link.sourceMain + link.targetMain) / 2;
  const p = (main: number, cross: number) => (vertical ? `${cross},${main}` : `${main},${cross}`);
  return [
    `M${p(link.sourceMain, link.source0)}`,
    `C${p(m, link.source0)} ${p(m, link.target0)} ${p(link.targetMain, link.target0)}`,
    `L${p(link.targetMain, link.target1)}`,
    `C${p(m, link.target1)} ${p(m, link.source1)} ${p(link.sourceMain, link.source1)}`,
    "Z",
  ].join(" ");
}
