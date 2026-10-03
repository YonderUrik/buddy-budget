"use client";

/** Primo passo dell'import: carica un file CSV o Excel (o incolla il testo) e offre il modello da compilare. */

import * as React from "react";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { pensionTemplateCsv } from "@/lib/pension/import/mapping";

export interface PensionImportFileStepProps {
  onFile: (file: File | undefined) => void;
  onText: (text: string) => void;
}

const TEMPLATE_FILE_NAME = "buddybudget-modello-pensione.csv";

function downloadTemplate() {
  // BOM: Excel apre il file in UTF-8 e mostra bene gli accenti delle intestazioni.
  const blob = new Blob(["﻿", pensionTemplateCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = TEMPLATE_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

export function PensionImportFileStep({ onFile, onText }: PensionImportFileStepProps) {
  const id = React.useId();
  const [pasted, setPasted] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Una riga per fotografia, con tre colonne: la data, i contributi netti e il controvalore. Il file viene letto nel tuo browser e non
        viene caricato né conservato: al server arrivano solo le righe che confermi.
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
          onFile(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${dragging ? "border-primary bg-primary/5" : ""}`}
      >
        <UploadIcon className="size-5 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">Scegli un file CSV o Excel (.xlsx)</span>
        <span className="text-xs text-muted-foreground">oppure trascinalo qui</span>
        <input
          id={`${id}-file`}
          type="file"
          accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-paste`} className="text-xs text-muted-foreground">
          Oppure incolla le righe (anche copiate da Excel)
        </label>
        <Textarea
          id={`${id}-paste`}
          rows={4}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40"}
          className="font-mono text-xs"
        />
        <Button variant="outline" size="sm" className="self-end" disabled={!pasted.trim()} onClick={() => onText(pasted)}>
          Leggi
        </Button>
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
        Non sai da dove partire?{" "}
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
          <DownloadIcon className="size-3.5" aria-hidden="true" /> Scarica il modello
        </button>{" "}
        e compilalo con i valori dell&apos;area clienti del tuo fondo.
      </div>
    </div>
  );
}
