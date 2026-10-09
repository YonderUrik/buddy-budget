"use client";

/**
 * Primo passo dell'import: scegli il broker (facoltativo: senza, il formato lo riconosce il file), leggi come esportare il
 * file e caricalo; in alternativa incolla il contenuto. Per un CSV personale offre il modello da compilare.
 */

import Link from "next/link";
import * as React from "react";
import { BuildingIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { ImportExportGuide } from "./import-export-guide";
import { ImportNotice } from "./import-notice";
import { explainFileError } from "@/lib/investments/import/messages";
import { Badge } from "@/components/ui/badge";
import { getImportProvider, type ImportProviderId } from "@/lib/investments/import/providers";
import { validateImportFiles } from "@/lib/investments/import/batch";
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

export function ImportFileStep({ provider, onProviderChange, onLoad, onFiles, reading = false }: ImportFileStepProps) {
  const id = React.useId();
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
      <section
        aria-label="Novità: formato personale con AI"
        className="flex gap-3 rounded-xl p-3.5"
        style={{ backgroundColor: "color-mix(in oklab, var(--swatch-violet) 10%, transparent)" }}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ color: "var(--swatch-violet)", backgroundColor: "color-mix(in oklab, var(--swatch-violet) 18%, transparent)" }} aria-hidden="true">
          <SparklesIcon className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Il tuo broker non è nell&apos;elenco? <Badge variant="secondary">Novità</Badge>
          </p>
          <p className="text-sm text-muted-foreground">Carica un CSV qualsiasi: l&apos;AI impara a leggerlo, crei il formato una volta e poi importi in automatico.</p>
          <Link href="/importazioni" className="self-start text-sm font-medium text-primary hover:underline">Crea il tuo formato con l&apos;AI →</Link>
        </div>
      </section>
      <DialogSection title="Da dove arriva il file?" icon={BuildingIcon} color="var(--swatch-indigo)" description="Scegli il broker per vedere come esportare il file, oppure salta e carica direttamente il file.">
        <ImportProviderPicker
          value={provider}
          onChange={onProviderChange}
          renderSelected={(info) => (
            <ImportExportGuide provider={info} />
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
        {onFiles ? <p className="text-sm text-muted-foreground">Hai più rendiconti? Selezionali insieme (fino a 20): vale per Interactive Brokers, DEGIRO e Trade Republic.</p> : null}
      </DialogSection>
    </DialogSections>
  );
}
