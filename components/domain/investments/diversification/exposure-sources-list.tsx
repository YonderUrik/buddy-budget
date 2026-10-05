"use client";

/** Elenco delle posizioni con la fonte di settore e area di ciascuna, e il bottone per correggerle a mano. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ExposureRow } from "@/lib/investments/analysis-view";
import { EXPOSURE_SOURCE_LABELS } from "@/lib/investments/exposure";
import { InstrumentIcon } from "../instrument-icon";

/** Posizioni mostrate prima di "Mostra tutte". */
export const EXPOSURE_ROWS_LIMIT = 5;

export interface ExposureSourcesListProps {
  rows: ExposureRow[];
  onEdit: (row: ExposureRow) => void;
}

function sharePct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function ExposureSourcesList({ rows, onEdit }: ExposureSourcesListProps) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? rows : rows.slice(0, EXPOSURE_ROWS_LIMIT);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y rounded-lg border" aria-label="Fonte dei dati di ogni posizione">
        {visible.map((row) => (
          <li key={row.instrument.id} className="flex items-center gap-3 px-3 py-2">
            <InstrumentIcon type={row.instrument.type} name={row.instrument.name} instrumentId={row.instrument.id} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">
                {row.instrument.name} <span className="tabular-nums text-muted-foreground">· {sharePct(row.share)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Area: {EXPOSURE_SOURCE_LABELS[row.exposure.areaSource]}
                <br className="sm:hidden" />
                <span className="hidden sm:inline"> · </span>
                Settore: {EXPOSURE_SOURCE_LABELS[row.exposure.sectorSource]}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
              Correggi
            </Button>
          </li>
        ))}
      </ul>
      {rows.length > EXPOSURE_ROWS_LIMIT ? (
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Mostra meno" : `Mostra tutte (${rows.length})`}
        </Button>
      ) : null}
    </div>
  );
}
