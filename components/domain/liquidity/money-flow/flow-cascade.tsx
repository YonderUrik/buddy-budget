"use client";

/**
 * Proposal C, «A cascata»: the money falls from top to bottom, income as one full-width bar that splits into groups and
 * set aside, then into categories. Shares sit on the bars, names and amounts in the list under the picture.
 */

import * as React from "react";
import { buildMoneyFlow, type FlowGroup, type FlowSource } from "@/lib/liquidity/money-flow";
import { bandPath, layoutSankey } from "@/lib/liquidity/sankey-layout";
import { useWidth } from "./use-width";

export interface FlowCascadeProps {
  sources: readonly FlowSource[];
  groups: readonly FlowGroup[];
  formatValue: (n: number) => string;
}

const PHONE_BREAKPOINT = 560;
const BAR = 16;
const LABEL_ROOM = 22;

export function FlowCascade({ sources, groups, formatValue }: FlowCascadeProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const phone = width > 0 && width < PHONE_BREAKPOINT;
  const flow = React.useMemo(() => buildMoneyFlow(sources, groups, { withSources: false, categoriesPerGroup: phone ? 3 : 5 }), [sources, groups, phone]);
  const step = phone ? 110 : 130;
  const levelStarts = [LABEL_ROOM, LABEL_ROOM + step, LABEL_ROOM + step * 2];
  const layout = React.useMemo(
    () => layoutSankey(flow, { levelStarts, nodeThickness: BAR, breadth: width, gap: phone ? 3 : 4, minSize: 2 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, width, phone]
  );
  const income = flow.nodes.find((n) => n.kind === "income")?.value ?? 0;
  const pct = (v: number) => `${Math.round((v / (income || 1)) * 100)}%`;
  const svgHeight = levelStarts[2] + BAR + 4;
  const isOn = (id: string, groupKey?: string) => hovered === null || hovered === id || hovered === `group:${groupKey}`;
  const savedNode = flow.nodes.find((n) => n.kind === "saved");

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={svgHeight} role="img" aria-label="Percorso dei soldi" className="block">
          {layout.links.map((l) => {
            const target = flow.nodes.find((n) => n.id === l.target);
            return <path key={`${l.source}-${l.target}`} d={bandPath(l, true)} fill={l.color} fillOpacity={isOn(l.target, target?.groupKey) ? 0.26 : 0.07} className="transition-[fill-opacity] duration-200" />;
          })}
          {layout.nodes.map((n) => {
            const w = n.cross1 - n.cross0;
            return (
              <g key={n.id} opacity={isOn(n.id, n.groupKey) ? 1 : 0.35} onPointerEnter={() => setHovered(n.kind === "category" ? `group:${n.groupKey}` : n.id)} onPointerLeave={() => setHovered(null)}>
                <rect x={n.cross0} y={n.main0} width={w} height={BAR} rx={4} fill={n.color} />
                {n.level < 2 && w >= 34 && (
                  <text x={n.cross0 + (n.kind === "income" ? 0 : w / 2)} y={n.main0 - 8} textAnchor={n.kind === "income" ? "start" : "middle"} className="fill-foreground text-[12px] font-semibold tabular-nums">
                    {n.kind === "income" ? `Entrate ${formatValue(n.value)}` : pct(n.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <div key={g.key} onPointerEnter={() => setHovered(`group:${g.key}`)} onPointerLeave={() => setHovered(null)}>
            <LegendRow color={g.color} label={g.label} value={`${formatValue(g.amount)} · ${pct(g.amount)}`} strong />
            <div className="mt-1 flex flex-col empty:hidden">
              {flow.nodes
                .filter((n) => n.kind === "category" && n.groupKey === g.key && !n.id.startsWith("category:pass:"))
                .map((n) => (
                  <LegendRow key={n.id} label={n.label} value={formatValue(n.value)} />
                ))}
            </div>
          </div>
        ))}
        {savedNode && (
          <div>
            <LegendRow color={savedNode.color} label={savedNode.label} value={`${formatValue(savedNode.value)} · ${pct(savedNode.value)}`} strong />
          </div>
        )}
      </div>
    </div>
  );
}

function LegendRow({ color, label, value, strong = false }: { color?: string; label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-baseline justify-between gap-3 py-1" : "flex items-baseline justify-between gap-3 py-0.5 pl-5 text-sm"}>
      <span className={strong ? "flex items-center gap-2 font-semibold" : "text-text-2"}>
        {color && <span className="size-3 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden="true" />}
        {label}
      </span>
      <span className={strong ? "font-heading font-semibold tabular-nums" : "tabular-nums text-text-2"}>{value}</span>
    </div>
  );
}
