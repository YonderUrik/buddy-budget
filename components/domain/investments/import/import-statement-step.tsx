"use client";

/**
 * Secondo passo per un rendiconto già strutturato (Interactive Brokers): al posto della mappatura delle colonne,
 * l'anteprima delle operazioni lette e l'elenco di ciò che il file contiene ma non viene importato.
 */

import { AlertTriangleIcon } from "lucide-react";
import type { ActivityIssue } from "@/lib/investments/import/interactive-brokers";
import type { ImportRow } from "@/lib/investments/import/normalize";
import { ImportRowsPreview } from "./import-rows-preview";

export interface ImportStatementStepProps {
  fileName: string | null;
  providerName: string;
  rows: ImportRow[];
  /** Eventi del rendiconto da controllare a mano (corporate action, movimenti di cassa, interessi...). */
  warnings: ActivityIssue[];
}

/** Avvisi elencati; gli altri si riassumono in un conteggio. */
const MAX_LISTED_WARNINGS = 5;

export function ImportStatementStep({ fileName, providerName, rows, warnings }: ImportStatementStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {fileName ? <span className="font-medium text-foreground">{fileName}</span> : "Testo incollato"}
        {` · formato riconosciuto: ${providerName}. Importo operazioni, eventi sul capitale, rendiconto e movimenti di cassa. I saldi e le posizioni devono riconciliarsi prima di salvare.`}
      </p>
      <ImportRowsPreview rows={rows} />
      {warnings.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <AlertTriangleIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {warnings.length} {warnings.length === 1 ? "voce non importata" : "voci non importate"}: da controllare a mano
          </p>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {warnings.slice(0, MAX_LISTED_WARNINGS).map((w) => (
              <li key={`${w.line}-${w.message}`}>
                Riga {w.line} · {w.section}: {w.message}
              </li>
            ))}
            {warnings.length > MAX_LISTED_WARNINGS ? <li>…e altre {warnings.length - MAX_LISTED_WARNINGS}.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
