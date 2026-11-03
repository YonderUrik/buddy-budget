"use client";

/**
 * Narrow view of the money flow (phone): two columns at a time, labels outside the bands. First income → groups and
 * set aside; a tap on a group shows that group → all its categories, and a tap on a category passes it on.
 */

import * as React from "react";
import { ChevronLeftIcon } from "lucide-react";
import { track } from "@/lib/analytics";
import { EXPENSE_GROUP_KEYS, type ExpenseGroup } from "@/lib/categories/groups";
import { useLocalization } from "@/lib/localization/provider";
import { buildGroupFlow, buildMoneyFlow, type FlowGroup, type FlowSource, type MoneyFlowLabels, type MoneyFlowNode } from "@/lib/liquidity/money-flow";
import { bandPath, layoutSankey, type PlacedNode } from "@/lib/liquidity/sankey-layout";

export interface FlowStepsProps {
  width: number;
  sources: readonly FlowSource[];
  groups: readonly FlowGroup[];
  labels: MoneyFlowLabels;
  formatValue: (n: number) => string;
  description: string;
  onPickCategory?: (categoryId: string) => void;
}

const NODE_WIDTH = 14;
const LEFT_LABEL = 92;
const RIGHT_LABEL = 150;
const HEIGHT = 320;
const GAP = 10;
/** Every node gets room for its two label lines, even a tiny amount. */
const MIN_NODE = 30;
const BAND_OPACITY = 0.24;

/** A spending group opens into its categories; uncategorised (its only category is itself) does not. */
function openableGroup(node: MoneyFlowNode): node is MoneyFlowNode & { groupKey: ExpenseGroup } {
  return node.kind === "group" && (EXPENSE_GROUP_KEYS as readonly string[]).includes(node.groupKey ?? "");
}

export function FlowSteps({ width, sources, groups, labels, formatValue, description, onPickCategory }: FlowStepsProps) {
  const { t: tr } = useLocalization();
  const [open, setOpen] = React.useState<string | null>(null);
  const group = groups.find((g) => g.key === open) ?? null;
  const flow = React.useMemo(
    () => (group ? buildGroupFlow(group) : buildMoneyFlow(sources, groups, { withSources: false, withCategories: false, labels: { ...labels, fromSavings: tr("Risparmi") } })),
    [group, sources, groups, labels, tr]
  );
  const layout = React.useMemo(
    () => layoutSankey(flow, { levelStarts: [LEFT_LABEL, Math.max(width - RIGHT_LABEL - NODE_WIDTH, LEFT_LABEL + 40)], nodeThickness: NODE_WIDTH, breadth: HEIGHT, gap: GAP, minSize: MIN_NODE }),
    [flow, width]
  );
  // Shares are of the money that came in (income, plus savings when spending exceeded it), or of the opened group.
  const total = group ? group.amount : Math.max(flow.income, flow.spent);

  const openGroup = (node: MoneyFlowNode) => {
    if (!openableGroup(node)) return;
    setOpen(node.groupKey);
    track("liquidity_flow_group_opened", { group: node.groupKey });
  };
  const actionOf = (node: MoneyFlowNode): (() => void) | undefined => {
    if (openableGroup(node)) return () => openGroup(node);
    if (node.categoryId && onPickCategory) return () => onPickCategory(node.categoryId!);
    return undefined;
  };

  return (
    <div>
      <div className="mb-4 flex min-h-11 items-center">
        {group ? (
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="-ml-3 flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-primary hover:bg-foreground/[0.05] focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
            {tr("Tutte le spese")}
          </button>
        ) : (
          <p className="text-sm text-text-2">{tr("Tocca un gruppo per vedere le sue categorie.")}</p>
        )}
      </div>
      <svg key={open ?? "all"} width={width} height={layout.used + 4} role="group" aria-label={group ? group.label : description} className="block animate-in fade-in duration-200 motion-reduce:animate-none">
        {layout.links.map((l) => (
          <path key={`${l.source}-${l.target}`} d={bandPath(l)} fill={l.color} fillOpacity={BAND_OPACITY} />
        ))}
        {layout.nodes.map((n) => {
          const action = n.level === 0 ? undefined : actionOf(n);
          return (
            <g
              key={n.id}
              role={action ? "button" : undefined}
              tabIndex={action ? 0 : undefined}
              aria-label={action ? `${n.label}, ${formatValue(n.value)}` : undefined}
              onClick={action}
              onKeyDown={action ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), action()) : undefined}
              className={action ? "cursor-pointer outline-none focus-visible:[&>rect:nth-child(2)]:stroke-ring focus-visible:[&>rect:nth-child(2)]:stroke-2" : undefined}
            >
              {/* Tap target: the node and its label. */}
              {n.level > 0 && <rect x={n.main0} y={n.cross0 - 4} width={RIGHT_LABEL + NODE_WIDTH} height={n.cross1 - n.cross0 + 8} fill="transparent" />}
              <rect x={n.main0} y={n.cross0} width={NODE_WIDTH} height={n.cross1 - n.cross0} rx={4} fill={n.color} />
              <SideLabel
                node={n}
                x={n.level === 0 ? n.main0 - 10 : n.main1 + 10}
                anchor={n.level === 0 ? "end" : "start"}
                amount={`${formatValue(n.value)}${n.level > 0 && total > 0 ? ` · ${Math.round((n.value / total) * 100)}%` : ""}`}
                chevron={openableGroup(n)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SideLabel({ node, x, anchor, amount, chevron }: { node: PlacedNode; x: number; anchor: "start" | "end"; amount: string; chevron: boolean }) {
  const mid = (node.cross0 + node.cross1) / 2;
  return (
    <>
      <text x={x} y={mid - 9} dominantBaseline="central" textAnchor={anchor} className="fill-foreground text-[15px] font-semibold">
        {node.label}
        {chevron && <tspan className="fill-text-3 font-normal">{"  ›"}</tspan>}
      </text>
      <text x={x} y={mid + 10} dominantBaseline="central" textAnchor={anchor} className="fill-text-2 text-[13px] tabular-nums">
        {amount}
      </text>
    </>
  );
}
