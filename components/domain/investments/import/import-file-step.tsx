"use client";

/**
 * Primo passo dell'import: scegli il broker (facoltativo: senza, il formato lo riconosce il file), leggi come esportare il
 * file e caricalo; in alternativa incolla il contenuto. Per un CSV personale offre il modello da compilare.
 */

import Link from "next/link";
import * as React from "react";
import { DownloadIcon, BuildingIcon, UploadIcon } from "lucide-react";
import { ImportExportGuide } from "./import-export-guide";
import { ImportNotice } from "./import-notice";
import { explainFileError } from "@/lib/investments/import/messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getImportProvider, type ImportProviderId } from "@/lib/investments/import/providers";
import { validateImportFiles } from "@/lib/investments/import/batch";
import { templateCsv } from "@/lib/investments/import/presets";
import { DialogSection, DialogSections } from "../dialog-parts";
import { gridToCsv } from "@/lib/investments/import/fineco";
import { readXlsx } from "@/lib/pension/import/xlsx";
import { ImportProviderPicker } from "./import-provider-picker";

export interface ImportFileStepProps {
  provider: ImportProviderId | null;
  onProviderChange: (provider: ImportProviderId | null) => void;
  onLoad: (text: string, fileName: string | null) => void;
  onFiles?: (files: File[]) => Promise<void>;
  /** Il file scelto è in lettura sul server. */
  reading?: boolean;
}

/** Nome del modello scaricato. */
const TEMPLATE_FILE_NAME = "buddybudget-modello-investimenti.csv";

function downloadTemplate() {
  // BOM: Excel apre il file in UTF-8 e mostra bene gli accenti delle intestazioni.
  const blob = new Blob(["﻿", templateCsv()], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = TEMPLATE_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportFileStep({ provider, onProviderChange, onLoad, onFiles, reading = false }: ImportFileStepProps) {
  const id = React.useId();
  const [pasted, setPasted] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  const [fileError, setFileError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  async function readFiles(list: FileList | null) {
    if (!list?.length || reading || loading) return;
    setFileError(null); setLoading(true);
    try {
      const files = Array.from(list);
      validateImportFiles(files);
      if (files.length > 1 && onFiles) await onFiles(files);
      else if (/\.xlsx$/i.test(files[0].name)) {
        // Fineco esporta in Excel: il foglio diventa testo e passa dallo stesso percorso dei CSV.
        const sheet = readXlsx(new Uint8Array(await files[0].arrayBuffer()));
        onLoad(gridToCsv([sheet.headers, ...sheet.rows]), files[0].name);
      } else onLoad(await files[0].text(), files[0].name);
    } catch (e) { setFileError(e instanceof Error ? e.message : "Impossibile leggere i file"); }
    finally { setLoading(false); }
  }
  const busy = reading || loading;
  const explained = fileError ? explainFileError(fileError) : null;
  const chosen = provider ? getImportProvider(provider) : null;

  return (
    <DialogSections>
      <DialogSection title="Da dove arriva il file?" icon={BuildingIcon} color="var(--swatch-indigo)" description="Scegli il tuo broker per vedere come esportare il file. Se non lo sai, carica direttamente il file: il formato lo riconosco da solo.">
        <ImportProviderPicker
          value={provider}
          onChange={onProviderChange}
          renderSelected={(info) => (
            <ImportExportGuide provider={info}>
              {info.id === "generic" ? (
                <div className="flex flex-col items-start gap-1.5 text-sm">
                  <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
                    <DownloadIcon className="size-3.5" aria-hidden="true" /> Scarica il modello da compilare
                  </button>
                  <Link href="/importazioni" className="font-medium text-primary hover:underline">Il tuo CSV è particolare? Crea il tuo formato con l&apos;AI →</Link>
                </div>
              ) : null}
            </ImportExportGuide>
          )}
        />
      </DialogSection>
      <DialogSection
        title="Carica il file"
        icon={UploadIcon}
        color="var(--primary)"
        description={chosen?.fileLabel ? `Ti serve: ${chosen.fileLabel}.` : "CSV o Excel esportato dal tuo broker."}
      >
        <label
          htmlFor={`${id}-file`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void readFiles(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${dragging ? "border-primary bg-primary/5" : ""}`}
        >
          <UploadIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{busy ? "Leggo il file…" : "Scegli un file"}</span>
          <span className="text-xs text-muted-foreground">{busy ? "Un attimo" : "oppure trascinalo qui"}</span>
          <input
            id={`${id}-file`}
            type="file"
            multiple={!!onFiles}
            disabled={busy}
            accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => { void readFiles(e.target.files); e.target.value = ""; }}
          />
        </label>
        {explained ? <ImportNotice tone="error" title={explained.text} hint={explained.hint} detail={fileError ?? undefined} /> : null}
        {onFiles ? <p className="text-sm text-muted-foreground">Hai più rendiconti? Selezionali insieme (fino a 20): vale per Interactive Brokers, DEGIRO e Trade Republic, li ordino io per conto e periodo. Fineco e gli altri file si caricano uno alla volta.</p> : null}
        <details className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <summary className="cursor-pointer">Il file non si carica? Incolla il contenuto</summary>
          <label htmlFor={`${id}-paste`} className="sr-only">
            Contenuto del file
          </label>
          <Textarea
            id={`${id}-paste`}
            rows={4}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Data;Tipo;ISIN;Quantità;Prezzo…"
            className="mt-2 font-mono text-xs"
          />
          <Button variant="outline" size="sm" className="self-end" disabled={!pasted.trim() || reading} onClick={() => onLoad(pasted, null)}>
            Leggi
          </Button>
        </details>
      </DialogSection>
    </DialogSections>
  );
}
