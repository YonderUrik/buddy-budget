"use client";

/**
 * Proposal B, «Un passo alla volta»: two columns at a time. First income → groups and set aside; a tap on a group
 * opens the same picture for that group → its categories. Labels sit outside the bands, so it reads on a phone.
 */

import * as React from "react";
import { ChevronLeftIcon } from "lucide-react";
import { buildGroupFlow, buildMoneyFlow, type FlowGroup, type FlowSource } from "@/lib/liquidity/money-flow";
import { bandPath, layoutSankey, type PlacedNode } from "@/lib/liquidity/sankey-layout";
import { useWidth } from "./use-width";

export interface FlowStepsProps {
  sources: readonly FlowSource[];
  groups: readonly FlowGroup[];
  formatValue: (n: number) => string;
}

const PHONE_BREAKPOINT = 560;
const NODE = 14;

export function FlowSteps({ sources, groups, formatValue }: FlowStepsProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [open, setOpen] = React.useState<string | null>(null);
  const phone = width > 0 && width < PHONE_BREAKPOINT;
  const group = groups.find((g) => g.key === open) ?? null;
  const flow = React.useMemo(
    () => (group ? buildGroupFlow(group) : buildMoneyFlow(sources, groups, { withSources: false, withCategories: false })),
    [group, sources, groups]
  );
  const total = flow.nodes.find((n) => n.level === 0)?.value ?? 0;
  const leftW = phone ? 76 : 170;
  const rightW = phone ? 150 : 240;
  const height = phone ? 320 : 440;
  const layout = React.useMemo(
    () => layoutSankey(flow, { levelStarts: [leftW, Math.max(width - rightW - NODE, leftW + 40)], nodeThickness: NODE, breadth: height, gap: phone ? 10 : 12, minSize: 30 }),
    [flow, width, leftW, rightW, height, phone]
  );

  return (
    <div ref={ref} className="w-full max-w-3xl">
      <div className="mb-4 flex min-h-11 items-center gap-2">
        {group ? (
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="-ml-2 flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-primary hover:bg-foreground/[0.05] focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
            Tutte le spese
          </button>
        ) : (
          <p className="text-sm text-text-2">Tocca un gruppo per vedere le sue categorie.</p>
        )}
      </div>
      {width > 0 && (
        <svg key={open ?? "all"} width={width} height={layout.used + 4} role="img" aria-label="Percorso dei soldi" className="block animate-in fade-in duration-200">
          {layout.links.map((l) => (
            <path key={`${l.source}-${l.target}`} d={bandPath(l)} fill={l.color} fillOpacity={0.24} />
          ))}
          {layout.nodes.map((n) =>
            n.level === 0 ? (
              <g key={n.id}>
                <rect x={n.main0} y={n.cross0} width={NODE} height={n.cross1 - n.cross0} rx={4} fill={n.color} />
                <SideLabel node={n} x={n.main0 - 10} anchor="end" formatValue={formatValue} />
              </g>
            ) : (
              <g
                key={n.id}
                role={n.kind === "group" && n.groupKey !== "daCategorizzare" ? "button" : undefined}
                tabIndex={n.kind === "group" ? 0 : undefined}
                onClick={n.kind === "group" && n.groupKey !== "daCategorizzare" ? () => setOpen(n.groupKey ?? null) : undefined}
                onKeyDown={n.kind === "group" ? (e) => e.key === "Enter" && setOpen(n.groupKey ?? null) : undefined}
                className={n.kind === "group" ? "cursor-pointer outline-none" : undefined}
              >
                <rect x={n.main0} y={n.cross0 - 4} width={rightW + NODE} height={n.cross1 - n.cross0 + 8} fill="transparent" />
                <rect x={n.main0} y={n.cross0} width={NODE} height={n.cross1 - n.cross0} rx={4} fill={n.color} />
                <SideLabel node={n} x={n.main1 + 10} formatValue={formatValue} share={total > 0 ? n.value / total : null} chevron={n.kind === "group" && n.groupKey !== "daCategorizzare"} />
              </g>
            )
          )}
        </svg>
      )}
    </div>
  );
}

function SideLabel({
  node,
  x,
  anchor = "start",
  formatValue,
  share = null,
  chevron = false,
}: {
  node: PlacedNode;
  x: number;
  anchor?: "start" | "end";
  formatValue: (n: number) => string;
  share?: number | null;
  chevron?: boolean;
}) {
  const mid = (node.cross0 + node.cross1) / 2;
  const amount = `${formatValue(node.value)}${share !== null ? ` · ${Math.round(share * 100)}%` : ""}`;
  return (
    <g>
      <text x={x} y={mid - 9} dominantBaseline="central" textAnchor={anchor} className="fill-foreground text-[15px] font-semibold">
        {node.label}
        {chevron && <tspan className="fill-text-3 font-normal">{"  ›"}</tspan>}
      </text>
      <text x={x} y={mid + 10} dominantBaseline="central" textAnchor={anchor} className="fill-text-2 text-[13px] tabular-nums">
        {amount}
      </text>
    </g>
  );
}
