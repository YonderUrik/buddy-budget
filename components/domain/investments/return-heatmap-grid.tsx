"use client";

/**
 * Griglia della heatmap dei rendimenti: caselle verdi (guadagno) e rosse (perdita), più intense quanto più il
 * rendimento è grande. Nella vista per mese e per anno le caselle mostrano anche il valore. Il dettaglio della
 * casella sotto il puntatore (o toccata) arriva a `onInspect`.
 */

import type { CSSProperties } from "react";
import { HEATMAP_LEVELS, type HeatmapCell, type ReturnHeatmap } from "@/lib/calc/return-heatmap";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "./gain-text";

/** Quota di verde o rosso mescolata al neutro per ogni livello (0 = neutro). */
const LEVEL_MIX = [0, 30, 50, 72, 100];

/** Colore di una casella dai token `--pos`/`--neg` mescolati al neutro `--muted`. */
export function heatmapCellColor(cell: HeatmapCell): string {
  if (cell.ret === null || cell.level === 0) return "var(--muted)";
  const tone = cell.ret > 0 ? "var(--pos)" : "var(--neg)";
  return `color-mix(in oklab, ${tone} ${LEVEL_MIX[Math.min(cell.level, HEATMAP_LEVELS)]}%, var(--muted))`;
}

export interface ReturnHeatmapGridProps {
  heatmap: ReturnHeatmap;
  onInspect: (cell: HeatmapCell | null) => void;
  selectedKey: string | null;
}

function Cell({ cell, showValue, selected, onInspect }: { cell: HeatmapCell | null; showValue: boolean; selected: boolean; onInspect: (c: HeatmapCell | null) => void }) {
  if (!cell) return <span aria-hidden="true" />;
  const strong = cell.level >= 3;
  return (
    <span
      aria-hidden="true"
      onMouseEnter={() => onInspect(cell)}
      onClick={() => onInspect(cell)}
      className={cn(
        "flex items-center justify-center rounded-[3px] tabular-nums",
        showValue ? "h-9 text-[11px] sm:text-xs" : "aspect-square",
        strong ? "text-background" : "text-foreground",
        selected && "ring-2 ring-foreground ring-offset-1 ring-offset-card"
      )}
      style={{ backgroundColor: heatmapCellColor(cell) }}
    >
      {showValue ? (cell.ret === null ? "" : formatSignedPct(cell.ret).replace("+", "")) : null}
    </span>
  );
}

export function ReturnHeatmapGrid({ heatmap, onInspect, selectedKey }: ReturnHeatmapGridProps) {
  const showValue = heatmap.grouping === "mese" || heatmap.grouping === "anno";
  const hasTotal = heatmap.rows.some((r) => r.total !== undefined);
  const hasRowLabels = heatmap.rows.some((r) => r.label !== "");
  const columnCount = heatmap.columns.length + (hasTotal ? 1 : 0);
  const cellSize = heatmap.grouping === "giorno" || heatmap.grouping === "settimana" ? "minmax(10px, 1fr)" : "minmax(2.5rem, 1fr)";
  const style: CSSProperties = {
    gridTemplateColumns: `${hasRowLabels ? "2.5rem " : ""}repeat(${columnCount}, ${cellSize})`,
  };
  const minWidth = heatmap.grouping === "giorno" || heatmap.grouping === "settimana" ? `${columnCount * 13 + 40}px` : undefined;

  return (
    <div className="overflow-x-auto pb-1" onMouseLeave={() => onInspect(null)}>
      <div className="grid gap-[3px] text-[10px] text-muted-foreground" style={{ ...style, minWidth }}>
        {hasRowLabels ? <span className="sticky left-0 z-10 bg-card" /> : null}
        {heatmap.columns.map((label, i) => (
          <span key={i} className="whitespace-nowrap text-left leading-4">
            {label}
          </span>
        ))}
        {hasTotal ? <span className="text-center font-medium leading-4">Anno</span> : null}
        {heatmap.rows.map((row) => (
          <div key={row.label || "row"} className="contents">
            {hasRowLabels ? (
              <span className="sticky left-0 z-10 flex items-center bg-card leading-none tabular-nums">{row.label}</span>
            ) : null}
            {row.cells.map((cell, i) => (
              <Cell key={cell?.key ?? `empty-${i}`} cell={cell} showValue={showValue} selected={cell?.key === selectedKey} onInspect={onInspect} />
            ))}
            {hasTotal ? (
              <Cell cell={row.total ?? null} showValue selected={row.total?.key === selectedKey} onInspect={onInspect} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
