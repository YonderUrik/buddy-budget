"use client";

/**
 * Proposal A, «Il percorso completo»: the classic left-to-right Sankey, sources → income → groups and set aside →
 * categories. On the phone the sources column folds into the income node and fewer categories are shown per group.
 */

import * as React from "react";
import { buildMoneyFlow, type FlowGroup, type FlowSource } from "@/lib/liquidity/money-flow";
import { bandPath, layoutSankey, type PlacedNode } from "@/lib/liquidity/sankey-layout";
import { useWidth } from "./use-width";

export interface FlowRiverProps {
  sources: readonly FlowSource[];
  groups: readonly FlowGroup[];
  formatValue: (n: number) => string;
}

const PHONE_BREAKPOINT = 560;
const NODE = 10;

export function FlowRiver({ sources, groups, formatValue }: FlowRiverProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const phone = width > 0 && width < PHONE_BREAKPOINT;
  const flow = React.useMemo(
    () => buildMoneyFlow(sources, groups, { withSources: !phone, categoriesPerGroup: phone ? 3 : 4 }),
    [sources, groups, phone]
  );
  const labelW = phone ? 112 : 170;
  const height = phone ? 400 : 460;
  const levels = phone ? 3 : 4;
  const span = Math.max(width - labelW - NODE, 0);
  const levelStarts = Array.from({ length: levels }, (_, i) => (span * i) / (levels - 1));
  const layout = React.useMemo(
    () => layoutSankey(flow, { levelStarts, nodeThickness: NODE, breadth: height, gap: phone ? 7 : 9 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, width, height, phone]
  );
  const connected = (id: string) => hovered === null || hovered === id || layout.links.some((l) => (l.source === hovered && l.target === id) || (l.target === hovered && l.source === id));

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={layout.used + 4} role="img" aria-label="Percorso dei soldi" className="block overflow-visible">
          {layout.links.map((l) => {
            const active = hovered === null || hovered === l.source || hovered === l.target;
            return <path key={`${l.source}-${l.target}`} d={bandPath(l)} fill={l.color} fillOpacity={active ? (hovered ? 0.45 : 0.22) : 0.06} className="transition-[fill-opacity] duration-200" />;
          })}
          {layout.nodes.map((n) => (
            <g key={n.id} onPointerEnter={() => setHovered(n.id)} onPointerLeave={() => setHovered(null)} className="cursor-default" opacity={connected(n.id) ? 1 : 0.35}>
              <rect x={n.main0} y={n.cross0} width={NODE} height={n.cross1 - n.cross0} rx={3} fill={n.color} />
              <NodeLabel node={n} formatValue={formatValue} x={n.main1 + 8} />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

/** Name and amount beside a node, with a halo of the page colour so it reads over the bands. */
export function NodeLabel({ node, formatValue, x, anchor = "start" }: { node: PlacedNode; formatValue: (n: number) => string; x: number; anchor?: "start" | "end" }) {
  const size = node.cross1 - node.cross0;
  const mid = (node.cross0 + node.cross1) / 2;
  if (node.hideLabel || size < 7) return null;
  const halo = { paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4, strokeLinejoin: "round" } as const;
  if (size < 26)
    return (
      <text x={x} y={mid} dominantBaseline="central" textAnchor={anchor} className="fill-foreground text-[12px] font-semibold" style={halo}>
        {node.label} <tspan className="fill-text-2 font-normal tabular-nums">{formatValue(node.value)}</tspan>
      </text>
    );
  return (
    <text x={x} y={mid - 8} textAnchor={anchor} dominantBaseline="central" style={halo}>
      <tspan className="fill-foreground text-[13px] font-semibold">{node.label}</tspan>
      <tspan x={x} dy={17} className="fill-text-2 text-[12px] tabular-nums">
        {formatValue(node.value)}
      </tspan>
    </text>
  );
}
