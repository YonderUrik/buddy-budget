"use client";

/** Primo passo dell'import: carica un file CSV o incollane il contenuto; offre il modello da compilare. */

import * as React from "react";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { templateCsv } from "@/lib/investments/import/presets";

export interface ImportFileStepProps {
  onLoad: (text: string, fileName: string | null) => void;
}

/** Nome del modello scaricato. */
const TEMPLATE_FILE_NAME = "buddybudget-modello-investimenti.csv";

function downloadTemplate() {
  // BOM: Excel apre il file in UTF-8 e mostra bene gli accenti delle intestazioni.
  const blob = new Blob(["﻿", templateCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = TEMPLATE_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportFileStep({ onLoad }: ImportFileStepProps) {
  const id = React.useId();
  const [pasted, setPasted] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  async function readFile(file: File | undefined) {
    if (file) onLoad(await file.text(), file.name);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Carica l&apos;export del tuo broker o di un&apos;app come Yahoo Finance. Se il formato non è tra quelli conosciuti,
        al passo successivo scegli tu quale colonna è la data, il prezzo e così via.
      </p>
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
        <span className="text-sm font-medium text-foreground">Scegli un file CSV</span>
        <span className="text-xs text-muted-foreground">oppure trascinalo qui</span>
        <input
          id={`${id}-file`}
          type="file"
          accept=".csv,.txt,text/csv"
          className="sr-only"
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-paste`} className="text-xs text-muted-foreground">
          Oppure incolla il contenuto
        </label>
        <Textarea
          id={`${id}-paste`}
          rows={4}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Data;Tipo;ISIN;Quantità;Prezzo…"
          className="font-mono text-xs"
        />
        <Button variant="outline" size="sm" className="self-end" disabled={!pasted.trim()} onClick={() => onLoad(pasted, null)}>
          Leggi
        </Button>
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
        Il tuo broker non esporta un CSV leggibile?{" "}
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
          <DownloadIcon className="size-3.5" aria-hidden="true" /> Scarica il modello
        </button>{" "}
        e compilalo con le tue operazioni.
      </div>
    </div>
  );
}
