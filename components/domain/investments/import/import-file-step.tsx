"use client";

/** Primo passo dell'import: carica un file CSV o incollane il contenuto; offre il modello da compilare. */

import Link from "next/link";
import * as React from "react";
import { DownloadIcon, BuildingIcon, UploadIcon } from "lucide-react";
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

  return (
    <DialogSections>
      <DialogSection title="Da dove arriva il file?" icon={BuildingIcon} color="var(--swatch-indigo)">
        <ImportProviderPicker value={provider} onChange={onProviderChange} />
        <Link href="/importazioni" className="text-sm font-medium text-primary hover:underline">CSV non supportato? Crea il tuo formato con AI →</Link>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {provider
            ? getImportProvider(provider).howTo
            : "Non sai quale scegliere? Carica il file: se è di un provider conosciuto lo riconosco da solo."}
        </p>
      </DialogSection>
      <DialogSection title="Carica il file" icon={UploadIcon} color="var(--primary)">
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
        <span className="text-sm font-medium text-foreground">{reading || loading ? "Leggo i file…" : "Scegli uno o più file CSV o Excel"}</span>
        <span className="text-xs text-muted-foreground">{reading || loading ? "Un attimo" : "oppure trascinali qui · massimo 20 file"}</span>
        <input
          id={`${id}-file`}
          type="file"
          multiple={!!onFiles}
          disabled={reading || loading}
          accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => { void readFiles(e.target.files); e.target.value = ""; }}
        />
      </label>

      {fileError ? <p role="alert" className="text-sm text-destructive">{fileError}</p> : null}
      <p className="text-sm text-muted-foreground">Più file insieme: rendiconti IBKR, DEGIRO e Trade Republic, ordinati per conto e periodo. Fineco e gli altri file si importano uno alla volta.</p>
      <details className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Oppure incolla il contenuto</summary>
        <label htmlFor={`${id}-paste`} className="sr-only">
          Contenuto del file
        </label>
        <Textarea
          id={`${id}-paste`}
          rows={4}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Data;Tipo;ISIN;Quantità;Prezzo…"
          className="font-mono text-xs"
        />
        <Button variant="outline" size="sm" className="self-end" disabled={!pasted.trim() || reading} onClick={() => onLoad(pasted, null)}>
          Leggi
        </Button>
      </details>

      {provider === "generic" || provider === null ? (
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Il tuo broker non esporta un CSV leggibile?{" "}
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
          >
            <DownloadIcon className="size-3.5" aria-hidden="true" /> Scarica il modello
          </button>{" "}
          e compilalo con le tue operazioni.
        </div>
      ) : null}
      </DialogSection>
    </DialogSections>
  );
}
