"use client";

/**
 * Wide view of the money flow (desktop and tablet): one left-to-right Sankey, sources → income → groups and set aside →
 * categories. Hovering a node lights its bands; a click on a category passes it on (e.g. to filter the movements).
 */

import * as React from "react";
import { useLocalization } from "@/lib/localization/provider";
import { buildMoneyFlow, type FlowGroup, type FlowSource, type MoneyFlowLabels } from "@/lib/liquidity/money-flow";
import { bandPath, layoutSankey, type PlacedNode } from "@/lib/liquidity/sankey-layout";

export interface FlowRiverProps {
  width: number;
  sources: readonly FlowSource[];
  groups: readonly FlowGroup[];
  labels: MoneyFlowLabels;
  formatValue: (n: number) => string;
  description: string;
  onPickCategory?: (categoryId: string) => void;
}

const NODE_WIDTH = 10;
const LABEL_WIDTH = 170;
const HEIGHT = 460;
const GAP = 9;
const LEVELS = 4;
const BAND_OPACITY = 0.22;
const BAND_OPACITY_LIT = 0.45;
const BAND_OPACITY_DIM = 0.06;

export function FlowRiver({ width, sources, groups, labels, formatValue, description, onPickCategory }: FlowRiverProps) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const flow = React.useMemo(() => buildMoneyFlow(sources, groups, { labels }), [sources, groups, labels]);
  const layout = React.useMemo(() => {
    const span = Math.max(width - LABEL_WIDTH - NODE_WIDTH, 0);
    const levelStarts = Array.from({ length: LEVELS }, (_, i) => (span * i) / (LEVELS - 1));
    return layoutSankey(flow, { levelStarts, nodeThickness: NODE_WIDTH, breadth: HEIGHT, gap: GAP });
  }, [flow, width]);
  const touches = (id: string) => hovered === null || hovered === id || layout.links.some((l) => (l.source === hovered && l.target === id) || (l.target === hovered && l.source === id));

  return (
    <svg width={width} height={layout.used + 4} role="img" aria-label={description} className="block overflow-visible">
      {layout.links.map((l) => {
        const lit = hovered === l.source || hovered === l.target;
        const opacity = hovered === null ? BAND_OPACITY : lit ? BAND_OPACITY_LIT : BAND_OPACITY_DIM;
        return <path key={`${l.source}-${l.target}`} d={bandPath(l)} fill={l.color} fillOpacity={opacity} className="transition-[fill-opacity] duration-200 motion-reduce:transition-none" />;
      })}
      {layout.nodes.map((n) => {
        const pickable = n.categoryId !== undefined && onPickCategory !== undefined;
        return (
          <g
            key={n.id}
            onPointerEnter={() => setHovered(n.id)}
            onPointerLeave={() => setHovered(null)}
            onClick={pickable ? () => onPickCategory(n.categoryId!) : undefined}
            className={pickable ? "cursor-pointer" : undefined}
            opacity={touches(n.id) ? 1 : 0.35}
          >
            <rect x={n.main0} y={n.cross0} width={NODE_WIDTH} height={n.cross1 - n.cross0} rx={3} fill={n.color} />
            <NodeLabel node={n} formatValue={formatValue} x={n.main1 + 8} />
          </g>
        );
      })}
    </svg>
  );
}

const ONE_LINE_BELOW = 26;
const NO_LABEL_BELOW = 7;

/** Name and amount beside a node, with a halo of the page colour so it reads over the bands. */
function NodeLabel({ node, formatValue, x }: { node: PlacedNode; formatValue: (n: number) => string; x: number }) {
  const { t: tr } = useLocalization();
  const size = node.cross1 - node.cross0;
  const mid = (node.cross0 + node.cross1) / 2;
  if (node.hideLabel || size < NO_LABEL_BELOW) return null;
  const halo = { paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4, strokeLinejoin: "round" } as const;
  const title = node.folded ? <title>{tr("{0} categorie", { 0: node.folded })}</title> : null;
  if (size < ONE_LINE_BELOW)
    return (
      <text x={x} y={mid} dominantBaseline="central" className="fill-foreground text-[12px] font-semibold" style={halo}>
        {title}
        {node.label} <tspan className="fill-text-2 font-normal tabular-nums">{formatValue(node.value)}</tspan>
      </text>
    );
  return (
    <text x={x} y={mid - 8} dominantBaseline="central" style={halo}>
      {title}
      <tspan className="fill-foreground text-[13px] font-semibold">{node.label}</tspan>
      <tspan x={x} dy={17} className="fill-text-2 text-[12px] tabular-nums">
        {formatValue(node.value)}
      </tspan>
    </text>
  );
}
