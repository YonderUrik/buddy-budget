/**
 * Quanto si muovono insieme le posizioni, a coppie e in parole: le più legate in alto, ognuna con un indicatore e un
 * giudizio. La tabella numerica completa resta per chi la vuole, in una sezione che si apre.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { CorrelationMatrix as Matrix } from "@/lib/calc/risk";
import type { Instrument } from "@/lib/db/schema/investments";
import { correlationLabel, correlationPairs } from "@/lib/investments/plain-labels";
import { cn } from "@/lib/utils";
import { Disclosure } from "../disclosure";
import { CorrelationMatrix } from "./correlation-matrix";

/** Coppie mostrate prima di "Mostra tutte". */
const PAIRS_VISIBLE = 4;

export interface CorrelationPairsProps {
  matrix: Matrix;
  instrumentsById: Map<string, Instrument>;
}

function decimal(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function CorrelationPairs({ matrix, instrumentsById }: CorrelationPairsProps) {
  const [showAll, setShowAll] = React.useState(false);
  const pairs = correlationPairs(matrix);
  const visible = showAll ? pairs : pairs.slice(0, PAIRS_VISIBLE);
  const nameOf = (id: string) => instrumentsById.get(id)?.name ?? "—";
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {visible.map((pair) => {
          const verdict = correlationLabel(pair.value);
          return (
            <li key={`${pair.aId}-${pair.bId}`} className="flex flex-col gap-1.5 rounded-xl border p-3">
              <p className="text-sm text-foreground">
                {nameOf(pair.aId)} <span className="text-muted-foreground">e</span> {nameOf(pair.bId)}
              </p>
              <p className="text-xs text-muted-foreground">
                {verdict.label} <span className="tabular-nums">({decimal(pair.value)})</span>
              </p>
              <div className="h-1.5 w-full rounded-full bg-muted" aria-hidden="true">
                <div
                  className={cn(
                    "h-full rounded-full",
                    verdict.severity === "alta" ? "bg-neg" : verdict.severity === "media" ? "bg-[var(--swatch-amber)]" : "bg-pos"
                  )}
                  style={{
                    width: `${Math.max(0.04, Math.max(0, pair.value)) * 100}%`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {pairs.length > PAIRS_VISIBLE ? (
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Mostra meno" : `Mostra tutte le coppie (${pairs.length})`}
        </Button>
      ) : null}
      <Disclosure bare title="Tabella completa" summary="Per chi vuole tutti i numeri">
        <CorrelationMatrix matrix={matrix} instrumentsById={instrumentsById} />
      </Disclosure>
    </div>
  );
}
