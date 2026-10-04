"use client";

/**
 * Card "Allocazione obiettivo": quanto ogni strumento si scosta dal peso voluto e dove mettere il prossimo
 * versamento. Senza obiettivo invita a impostarlo partendo dai pesi di oggi.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Instrument } from "@/lib/db/schema/investments";
import {
  ALLOCATION_TOLERANCE,
  roundedCurrentWeights,
  type AllocationAnalysis,
  type AllocationRow,
  type TargetInput,
} from "@/lib/investments/allocation";
import { cn } from "@/lib/utils";
import { ContributionSuggestions } from "./contribution-suggestions";
import { TargetsDialog } from "./targets-dialog";

/** Importo proposto per il prossimo versamento. */
const DEFAULT_CONTRIBUTION = 100;

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function driftText(row: AllocationRow): string {
  if (!row.inTarget && row.status === "in_linea") return "non nell'obiettivo";
  if (row.status === "in_linea") return "in linea";
  const points = Math.round(Math.abs(row.drift) * 100);
  return `${row.drift < 0 ? "−" : "+"}${points} punti`;
}

function AllocationBar({ row }: { row: AllocationRow }) {
  const scale = Math.max(row.currentWeight, row.targetWeight, 0.01);
  const max = Math.min(1, scale * 1.15);
  return (
    <div className="relative h-2 w-full rounded-full bg-muted" aria-hidden="true">
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full", row.status === "in_linea" ? "bg-primary" : row.status === "sotto" ? "bg-[var(--swatch-amber)]" : "bg-[var(--swatch-violet)]")}
        style={{ width: `${(row.currentWeight / max) * 100}%` }}
      />
      {row.inTarget ? <div className="absolute -inset-y-1 w-0.5 rounded bg-foreground" style={{ left: `${(row.targetWeight / max) * 100}%` }} /> : null}
    </div>
  );
}

export interface AllocationCardProps {
  allocation: AllocationAnalysis | null;
  targets: TargetInput[];
  /** Posizioni di oggi (per partire dai pesi attuali). */
  positions: { instrumentId: string; value: number | null }[];
  instrumentsById: Map<string, Instrument>;
  suggestions: Instrument[];
  currency: string;
  onRegister: (instrumentId: string, amount: number) => void;
}

export function AllocationCard({
  allocation,
  targets,
  positions,
  instrumentsById,
  suggestions,
  currency,
  onRegister,
}: AllocationCardProps) {
  const [editing, setEditing] = React.useState(false);
  const initial = targets.length > 0 ? targets : roundedCurrentWeights(positions);
  const outOfLine = allocation?.rows.filter((r) => r.status !== "in_linea") ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Allocazione obiettivo</CardTitle>
            <p className="text-sm text-muted-foreground">
              {allocation
                ? outOfLine.length === 0
                  ? `Tutto entro ±${Math.round(ALLOCATION_TOLERANCE * 100)} punti dall'obiettivo.`
                  : `${outOfLine.length === 1 ? "Uno strumento è" : `${outOfLine.length} strumenti sono`} fuori di più di ${Math.round(ALLOCATION_TOLERANCE * 100)} punti.`
                : "Decidi quanto deve pesare ogni strumento: ti diciamo dove mettere il prossimo versamento."}
            </p>
          </div>
          {allocation ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Modifica
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {allocation ? (
          <>
            <ul className="flex flex-col gap-3">
              {allocation.rows.map((row) => (
                <li key={row.instrumentId} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-foreground">{instrumentsById.get(row.instrumentId)?.name ?? "—"}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {pct(row.currentWeight)}
                      {row.inTarget ? ` su ${pct(row.targetWeight)}` : ""} ·{" "}
                      <span className={cn(row.status === "in_linea" ? "text-muted-foreground" : "font-medium text-foreground")}>{driftText(row)}</span>
                    </span>
                  </div>
                  <AllocationBar row={row} />
                </li>
              ))}
            </ul>
            {allocation.unpricedIds.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Esclusi perché senza prezzo: {allocation.unpricedIds.map((id) => instrumentsById.get(id)?.name ?? "—").join(", ")}.
              </p>
            ) : null}
            <ContributionSuggestions
              analysis={allocation}
              defaultAmount={DEFAULT_CONTRIBUTION}
              instrumentsById={instrumentsById}
              currency={currency}
              onRegister={onRegister}
            />
          </>
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setEditing(true)}>
            Imposta un obiettivo
          </Button>
        )}
      </CardContent>
      <TargetsDialog
        open={editing}
        onOpenChange={setEditing}
        initial={initial}
        hasSaved={targets.length > 0}
        instrumentsById={instrumentsById}
        suggestions={suggestions}
        currency={currency}
      />
    </Card>
  );
}
