"use client";

/**
 * Secondo passo dell'import: anteprima di cosa si legge dal file e, sotto, le colonne e i formati. Se il formato è
 * riconosciuto le colonne restano chiuse (basta controllare l'anteprima); altrimenti sono aperte da compilare.
 */

import { ChevronRightIcon } from "lucide-react";
import type { CsvTable } from "@/lib/investments/import/csv";
import type { ImportMapping } from "@/lib/investments/import/mapping";
import type { ImportRow } from "@/lib/investments/import/normalize";
import type { ImportPreset } from "@/lib/investments/import/presets";
import { ImportMappingFields } from "./import-mapping-fields";
import { ImportRowsPreview } from "./import-rows-preview";

export interface ImportMappingStepProps {
  fileName: string | null;
  table: CsvTable;
  preset: ImportPreset | null;
  mapping: ImportMapping;
  rows: ImportRow[];
  /** Campi indispensabili ancora senza colonna. */
  missing: string[];
  onChange: (patch: Partial<ImportMapping>) => void;
}

export function ImportMappingStep({ fileName, table, preset, mapping, rows, missing, onChange }: ImportMappingStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {fileName ? <span className="font-medium text-foreground">{fileName}</span> : "Testo incollato"}
        {" · "}
        {preset ? `formato riconosciuto: ${preset.label}.` : "formato non riconosciuto: indica cosa contiene ogni colonna."}
      </p>
      {missing.length > 0 ? (
        <p className="text-sm text-destructive">Indica quale colonna contiene {missing.join(", ")}.</p>
      ) : (
        <ImportRowsPreview rows={rows} />
      )}
      <details open={!preset || missing.length > 0} className="group rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
          Colonne e formati
        </summary>
        <div className="border-t p-3">
          <ImportMappingFields table={table} mapping={mapping} onChange={onChange} />
        </div>
      </details>
    </div>
  );
}
