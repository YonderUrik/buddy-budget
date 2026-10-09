"use client";

/**
 * Secondo passo per un CSV a colonne: cosa ho letto e quanto verrà importato, poi come leggo le colonne. Se il formato
 * è riconosciuto le colonne restano chiuse (basta controllare l'anteprima); altrimenti sono aperte da compilare.
 */

import { ChevronRightIcon, TableIcon } from "lucide-react";
import type { CsvTable } from "@/lib/investments/import/csv";
import type { ImportMapping } from "@/lib/investments/import/mapping";
import type { ImportRow } from "@/lib/investments/import/normalize";
import type { ImportPreset } from "@/lib/investments/import/presets";
import { DialogSection, DialogSections } from "../dialog-parts";
import { ImportMappingFields } from "./import-mapping-fields";
import { ImportNotice } from "./import-notice";
import { ImportRowsPreview, PreviewHeader, PreviewNumbers, SkippedRows } from "./import-preview-parts";

export interface ImportMappingStepProps {
  fileName: string | null;
  /** Nome del formato riconosciuto (preset o broker), `null` se sconosciuto. */
  providerName?: string | null;
  table: CsvTable;
  preset: ImportPreset | null;
  mapping: ImportMapping;
  rows: ImportRow[];
  /** Campi indispensabili ancora senza colonna. */
  missing: string[];
  onChange: (patch: Partial<ImportMapping>) => void;
}

export function ImportMappingStep({ fileName, providerName, table, preset, mapping, rows, missing, onChange }: ImportMappingStepProps) {
  const ok = rows.filter((r) => r.status === "ok");
  const withWarning = ok.filter((r) => r.warnings.length > 0).length;
  const recognizedAs = providerName ?? preset?.label ?? null;
  const fields = <ImportMappingFields table={table} mapping={mapping} onChange={onChange} />;
  return (
    <DialogSections>
      <DialogSection>
        <PreviewHeader fileName={fileName} providerName={recognizedAs} />
        {missing.length === 0 ? (
          <PreviewNumbers
            items={[
              { value: ok.length, label: ok.length === 1 ? "operazione da importare" : "operazioni da importare" },
              { value: rows.length - ok.length, label: "righe non importate", attention: true },
              { value: withWarning, label: "con un avviso", attention: true },
            ]}
          />
        ) : (
          <ImportNotice tone="warning" title="Mi manca qualche colonna" hint={`Indica quale colonna contiene ${missing.join(", ")}.`} />
        )}
      </DialogSection>
      {missing.length === 0 && ok.length > 0 ? (
        <DialogSection title="Le prime operazioni" description={withWarning > 0 ? `${withWarning} con un avviso: controllale prima di proseguire.` : undefined}>
          <ImportRowsPreview rows={rows} />
        </DialogSection>
      ) : null}
      {missing.length === 0 && ok.length === 0 && rows.length > 0 ? (
        <DialogSection>
          <ImportNotice tone="error" title="Con queste colonne non trovo nessuna operazione valida" hint="Controlla qui sotto che colonne e formati (date, decimali) siano quelli del tuo file." />
        </DialogSection>
      ) : null}
      {missing.length === 0 ? <SkippedRows rows={rows} /> : null}
      {recognizedAs && missing.length === 0 ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
            Come leggo le colonne
          </summary>
          <div className="pt-2">{fields}</div>
        </details>
      ) : (
        <DialogSection title="Come leggo le colonne" icon={TableIcon} color="var(--swatch-indigo)" description="Per ogni informazione scegli la colonna del tuo file. La prossima volta ricordo la scelta per file con le stesse intestazioni.">
          {fields}
        </DialogSection>
      )}
    </DialogSections>
  );
}
