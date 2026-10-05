"use client";

/** Primo passo dell'import: carica un file CSV o incollane il contenuto; offre il modello da compilare. */

import * as React from "react";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getImportProvider, type ImportProviderId } from "@/lib/investments/import/providers";
import { templateCsv } from "@/lib/investments/import/presets";
import { ImportProviderPicker } from "./import-provider-picker";

export interface ImportFileStepProps {
  provider: ImportProviderId | null;
  onProviderChange: (provider: ImportProviderId | null) => void;
  /** Provider scelto dopo aver usato la ricerca (misura). */
  onProviderSearched?: (provider: ImportProviderId) => void;
  onLoad: (text: string, fileName: string | null) => void;
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

export function ImportFileStep({ provider, onProviderChange, onProviderSearched, onLoad, reading = false }: ImportFileStepProps) {
  const id = React.useId();
  const [pasted, setPasted] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  async function readFile(file: File | undefined) {
    if (file) onLoad(await file.text(), file.name);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">Da dove arriva il file?</p>
        <ImportProviderPicker value={provider} onChange={onProviderChange} onSearchedChoice={onProviderSearched} />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {provider
            ? getImportProvider(provider).howTo
            : "Non sai quale scegliere? Carica il file: se è di un provider conosciuto lo riconosco da solo."}
        </p>
      </div>
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
          void readFile(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${dragging ? "border-primary bg-primary/5" : ""}`}
      >
        <UploadIcon className="size-5 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">{reading ? "Leggo il file…" : "Scegli un file CSV"}</span>
        <span className="text-xs text-muted-foreground">{reading ? "Un attimo" : "oppure trascinalo qui"}</span>
        <input
          id={`${id}-file`}
          type="file"
          accept=".csv,.txt,text/csv"
          className="sr-only"
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
      </label>

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
    </div>
  );
}
