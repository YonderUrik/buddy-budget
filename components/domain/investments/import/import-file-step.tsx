"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Primo passo dell'import: carica il file (il formato lo riconosce da solo). Chi non sa come esportarlo apre «Come lo
 * ottengo?» e sceglie il broker per leggere i passi; chi non trova il suo broker può creare un formato personale.
 */

import Link from "next/link";
import * as React from "react";
import { ChevronDownIcon, UploadIcon } from "lucide-react";
import { ImportExportGuide } from "./import-export-guide";
import { ImportNotice } from "./import-notice";
import { explainFileError } from "@/lib/investments/import/messages";
import { getImportProvider, type ImportProviderId } from "@/lib/investments/import/providers";
import { validateImportFiles } from "@/lib/investments/import/batch";
import { gridToCsv } from "@/lib/investments/import/fineco";
import { readXlsx } from "@/lib/pension/import/xlsx";
import { ImportProviderPicker } from "./import-provider-picker";
import { ReportErrorLink } from "@/components/domain/support";

export interface ImportFileStepProps {
  provider: ImportProviderId | null;
  onProviderChange: (provider: ImportProviderId | null) => void;
  onLoad: (text: string, fileName: string | null) => void;
  onFiles?: (files: File[]) => Promise<void>;
  /** Il file scelto è in lettura sul server. */
  reading?: boolean;
}

export function ImportFileStep({ provider, onProviderChange, onLoad, onFiles, reading = false }: ImportFileStepProps) {
  const { t: tr } = useLocalization();
  const id = React.useId();
  const [dragging, setDragging] = React.useState(false);
  const [showGuide, setShowGuide] = React.useState(provider !== null);

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
    } catch (e) { setFileError(e instanceof Error ? e.message : tr("Impossibile leggere i file")); }
    finally { setLoading(false); }
  }
  const busy = reading || loading;
  const explained = fileError ? explainFileError(fileError) : null;
  const chosen = provider ? getImportProvider(provider) : null;

  return (
    <div className="flex flex-col gap-4">
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
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${dragging ? "border-primary bg-primary/5" : ""}`}
      >
        <UploadIcon className="size-6 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">{busy ? tr("Leggo il file…") : tr("Scegli il file del tuo broker")}</span>
        <span className="text-xs text-muted-foreground">
          {busy ? tr("Un attimo") : chosen?.fileLabel ? tr("Ti serve: {0}. Oppure trascinalo qui.", {0: chosen.fileLabel}) : tr("CSV o Excel, oppure trascinalo qui.")}
        </span>
        <input
          id={`${id}-file`}
          type="file"
          data-autofocus
          multiple={!!onFiles}
          disabled={busy}
          accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => { void readFiles(e.target.files); e.target.value = ""; }}
        />
      </label>
      {explained ? <ImportNotice tone="error" title={explained.text} hint={tr(explained.hint)} detail={fileError ?? undefined} action={<ReportErrorLink area="import_investimenti" error={fileError ?? explained.text} />} /> : null}
      {onFiles ? <p className="text-center text-sm text-muted-foreground">{tr("Più rendiconti? Selezionali insieme (fino a 20): IBKR, DEGIRO e Trade Republic.")}</p> : null}

      <div className="flex flex-col gap-3 border-t pt-3">
        <button
          type="button"
          aria-expanded={showGuide}
          onClick={() => setShowGuide((open) => !open)}
          className="flex min-h-11 w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:underline sm:min-h-9"
        >{tr("Come ottengo il file?")}<ChevronDownIcon className={`size-4 transition-transform ${showGuide ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {showGuide ? (
          <ImportProviderPicker value={provider} onChange={onProviderChange} renderSelected={(info) => <ImportExportGuide provider={info} />} />
        ) : null}
        <p className="text-sm text-muted-foreground">{tr("Il tuo broker non c'è?")}{" "}
          <Link href="/importazioni" className="font-medium text-primary hover:underline">{tr("Crea il tuo formato")}</Link>
          {"."}</p>
      </div>
    </div>
  );
}
