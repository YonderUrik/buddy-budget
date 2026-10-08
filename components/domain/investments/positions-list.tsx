"use client";

/**
 * Posizioni aperte, dalla più pesante. In testa una lettura della concentrazione e una barra composta con il peso di
 * ogni posizione; poi una tabella compatta su desktop e schede espandibili su mobile (`PositionRowView`). Mostra
 * sempre data e origine del prezzo (un prezzo vecchio o stimato si vede, non si nasconde) e lo stato del recupero
 * dello storico.
 */

import * as React from "react";
import { ChartPieIcon } from "lucide-react";
import type { PositionRow } from "@/lib/calc/investments";
import type { ConcentrationInsight } from "@/lib/investments/insights";
import type { BackfillStateView } from "@/lib/market-data/backfill-state";
import { cn } from "@/lib/utils";
import { PanelSection } from "./panel-section";
import { INSTRUMENT_TYPE_COLOR } from "./instrument-colors";
import { PositionRowView, POSITIONS_GRID_COLUMNS } from "./position-row";
import { concentrationText, percent } from "./positions-format";

export { STALE_PRICE_DAYS } from "./positions-format";

/** Il servizio dei loghi va citato (condizione del piano gratuito). */
const LOGO_SERVICE_URL = "https://logo.dev";
const COLUMN_LABELS = ["Strumento", "Posizione", "Ultimo prezzo", "Valore", "Utile", "Peso", ""];

export interface PositionsListProps {
  rows: PositionRow[];
  concentration: ConcentrationInsight | null;
  currency: string;
  todayKey: string;
  backfill: BackfillStateView[];
  onManualPrice: (row: PositionRow) => void;
}

export function PositionsList({ rows, concentration, currency, todayKey, backfill, onManualPrice }: PositionsListProps) {
  const [logosShown, setLogosShown] = React.useState(false);
  const loading = new Set(backfill.filter((b) => b.status === "running" && !b.interrupted).map((b) => b.instrumentId));
  const insight = concentrationText(concentration);
  const weighted = rows.filter((r) => r.weight !== null);
  return (
    <PanelSection icon={ChartPieIcon} title="Posizioni" className="@container" description={insight}>
      {weighted.length > 1 ? (
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Peso di ogni posizione nel portafoglio">
          {weighted.map((r) => (
            <div
              key={r.instrument.id}
              className="h-full min-w-0.5"
              style={{ flexGrow: r.weight ?? 0, backgroundColor: INSTRUMENT_TYPE_COLOR[r.instrument.type] }}
              title={`${r.instrument.name} · ${percent(r.weight ?? 0)}`}
            />
          ))}
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna posizione aperta.</p>
      ) : (
        <>
          <div
            className={cn("hidden items-center gap-x-4 border-b border-border px-4 pb-2 text-xs font-medium text-muted-foreground @3xl:grid sm:px-6", POSITIONS_GRID_COLUMNS)}
            aria-hidden="true"
          >
            {COLUMN_LABELS.map((label, i) => (
              <span key={i} className={i === 3 || i === 4 ? "text-right" : undefined}>
                {label}
              </span>
            ))}
          </div>
          <ul className="-mx-4 divide-y divide-border sm:-mx-6">
            {rows.map((row) => (
              <PositionRowView
                key={row.instrument.id}
                row={row}
                currency={currency}
                todayKey={todayKey}
                loadingHistory={loading.has(row.instrument.id)}
                onManualPrice={onManualPrice}
                onRemoteLogo={() => setLogosShown(true)}
              />
            ))}
          </ul>
          {logosShown ? (
            <p className="text-xs text-muted-foreground">
              Loghi forniti da{" "}
              <a href={LOGO_SERVICE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Logo.dev
              </a>
            </p>
          ) : null}
        </>
      )}
    </PanelSection>
  );
}
