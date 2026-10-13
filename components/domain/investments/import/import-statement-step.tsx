"use client";

/**
 * Secondo passo per un rendiconto già strutturato (Interactive Brokers, DEGIRO, Trade Republic): cosa ho letto, quanto
 * verrà importato, le prime operazioni e ciò che il file contiene ma non viene importato, con il motivo.
 */

import { ImportRowsPreview, PreviewHeader, PreviewNumbers, SkippedRows, StatementWarnings } from "./import-preview-parts";
import type { ActivityIssue } from "@/lib/investments/import/interactive-brokers";
import type { ImportRow } from "@/lib/investments/import/normalize";
import type { TradeRepublicCashMovement } from "@/lib/investments/import/trade-republic";
import { DialogSection, DialogSections } from "../dialog-parts";
import { ImportNotice } from "./import-notice";

export interface ImportStatementStepProps {
  fileName: string | null;
  providerName: string;
  rows: ImportRow[];
  /** Eventi del rendiconto da controllare a mano (corporate action, movimenti di cassa, interessi...). */
  warnings: ActivityIssue[];
  cashMovements?: TradeRepublicCashMovement[];
  /** Campo per scegliere dove mettere i dati (portafoglio), quando serve. */
  destination?: React.ReactNode;
}

/** Movimenti del conto elencati; gli altri si riassumono in un conteggio. */
const MAX_LISTED_CASH = 4;

export function ImportStatementStep({ fileName, providerName, rows, warnings, cashMovements, destination }: ImportStatementStepProps) {
  const operations = rows.filter((r) => r.status === "ok").length;
  const notImported = rows.length - operations;
  return (
    <DialogSections>
      <DialogSection>
        <PreviewHeader fileName={fileName} providerName={providerName} />
        <PreviewNumbers
          items={[
            { value: operations, label: operations === 1 ? "operazione da importare" : "operazioni da importare" },
            ...(cashMovements ? [{ value: cashMovements.length, label: "movimenti del conto" }] : []),
            { value: notImported + warnings.length, label: "da guardare", attention: true },
          ]}
        />
        {operations === 0 && !cashMovements?.length ? (
          <ImportNotice tone="error" title="Non ci sono operazioni da importare in questo file" hint="Controlla di aver esportato il periodo giusto e di aver scelto il file del broker corretto." />
        ) : null}
      </DialogSection>
      {destination ? <DialogSection>{destination}</DialogSection> : null}
      {operations > 0 ? (
        <DialogSection title="Le prime operazioni">
          <ImportRowsPreview rows={rows} />
        </DialogSection>
      ) : null}
      {cashMovements && cashMovements.length > 0 ? (
        <DialogSection title="Movimenti del conto" description="Pagamenti con carta, bonifici, interessi e bonus: finiscono in Liquidità → Movimenti, da categorizzare. Il saldo si calcola dallo storico completo partendo da zero, perché il file non contiene un saldo ufficiale.">
          <ul className="flex flex-col divide-y text-sm">
            {cashMovements.slice(0, MAX_LISTED_CASH).map((m) => (
              <li key={m.externalId} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{m.date.split("-").reverse().join("/")} · </span>
                  {m.description}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums">{m.amount.toFixed(2)} {m.currency}</span>
              </li>
            ))}
          </ul>
          {cashMovements.length > MAX_LISTED_CASH ? <p className="text-xs text-muted-foreground">…e altri {cashMovements.length - MAX_LISTED_CASH} movimenti, tutti inclusi.</p> : null}
        </DialogSection>
      ) : null}
      <SkippedRows rows={rows} />
      <StatementWarnings warnings={warnings} />
    </DialogSections>
  );
}
