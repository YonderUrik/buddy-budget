"use client";

/**
 * Modulo di caricamento di un CSV o Excel personale, in tre passi: da dove arriva, il file, il consenso all'analisi AI.
 * Un file Excel diventa testo CSV nel browser (stesso lettore di Pensione e Investimenti); il server riceve sempre CSV.
 */

import { ReportErrorLink } from "@/components/domain/support";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheetIcon, UploadIcon, XIcon } from "lucide-react";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import { gridToCsv } from "@/lib/investments/import/fineco";
import { readXlsx, XLSX_MAX_FILE_BYTES } from "@/lib/pension/import/xlsx";
import { cn } from "@/lib/utils";
import { personalImportApi } from "./personal-import-api";
import type { PersonalImportReceiptFile } from "./personal-import-receipt";

export const PERSONAL_IMPORT_MAX_BYTES = 25 * 1024 * 1024;
export const PERSONAL_IMPORT_MAX_ROWS = 50_000;
const CONSENT_VERSION = "openrouter-raw-zdr-v2";
const NEW_FORMAT = "__new__";
const FIELD_CLASS = "h-11 sm:h-9";
const PERSONAL_IMPORT_STEPS = 3;

interface LoadedFile {
  name: string;
  size: number;
  csv: string;
}

/** Peso di un file in forma leggibile (KB o MB). */
export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Legge un file scelto dall'utente e lo restituisce come testo CSV; lancia con un messaggio comprensibile se non va. */
export async function readPersonalImportFile(file: File): Promise<LoadedFile> {
  if (/\.xlsx$/i.test(file.name)) {
    if (file.size > XLSX_MAX_FILE_BYTES) throw new Error(`Il file Excel pesa ${formatFileSize(file.size)}: il massimo è ${formatFileSize(XLSX_MAX_FILE_BYTES)}. Esporta il foglio in CSV e riprova.`);
    const sheet = readXlsx(new Uint8Array(await file.arrayBuffer()));
    return { name: file.name, size: file.size, csv: gridToCsv([sheet.headers, ...sheet.rows]) };
  }
  if (/\.xls$/i.test(file.name)) throw new Error("I file .xls (Excel antico) non si leggono. In Excel scegli «Salva con nome» e poi «Cartella di lavoro di Excel (.xlsx)» o «CSV».");
  if (file.size > PERSONAL_IMPORT_MAX_BYTES) throw new Error(`Il file pesa ${formatFileSize(file.size)}: il massimo è ${formatFileSize(PERSONAL_IMPORT_MAX_BYTES)}.`);
  return { name: file.name, size: file.size, csv: await file.text() };
}

/** Righe di dati di un testo CSV (intestazione e righe vuote escluse). */
export function countCsvRows(csv: string): number {
  return Math.max(0, csv.split(/\r?\n/).filter((line) => line.trim() !== "").length - 1);
}

export interface PersonalImportUploadProps {
  /** Formati già creati dall'utente, riusabili senza altra analisi. */
  formats: { id: string; name: string }[];
  /** Chiamato con l'id del lavoro creato e i dati del file inviato. */
  onQueued: (jobId: string, file: PersonalImportReceiptFile) => void;
}

export function PersonalImportUpload({ formats, onQueued }: PersonalImportUploadProps) {
  const id = React.useId();
  const flow = useStepFlow(PERSONAL_IMPORT_STEPS);
  const client = useQueryClient();
  const [formatId, setFormatId] = React.useState(NEW_FORMAT);
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<LoadedFile | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const [regenerate, setRegenerate] = React.useState(false);
  const isNew = formatId === NEW_FORMAT;

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Scegli un file da importare.");
      const source = formats.find((f) => f.id === formatId)?.name ?? name.trim();
      return personalImportApi<{ id: string }>("", { name: source, csv: file.csv, formatId: isNew ? undefined : formatId, regenerate, consent, consentVersion: CONSENT_VERSION });
    },
    onSuccess: (result) => {
      track("personal_csv_requested", { reuse: !isNew });
      const sent = file && { name: file.name, size: file.size, rows: countCsvRows(file.csv), source: formats.find((f) => f.id === formatId)?.name ?? name.trim() };
      setFile(null);
      setConsent(false);
      setRegenerate(false);
      void client.invalidateQueries({ queryKey: ["personal-imports"] });
      if (sent) onQueued(result.id, sent);
    },
  });

  async function pick(list: FileList | null) {
    const chosen = list?.[0];
    if (!chosen || reading) return;
    setFileError(null);
    setReading(true);
    try {
      setFile(await readPersonalImportFile(chosen));
    } catch (e) {
      setFile(null);
      setFileError(e instanceof Error ? e.message : "Non riesco a leggere questo file.");
    } finally {
      setReading(false);
    }
  }

  const missing: string[] = [];
  if (isNew && !name.trim()) missing.push("scrivi da dove arriva il file");
  if (!file) missing.push("scegli il file");
  if (!consent) missing.push("dai il consenso all'analisi");
  const ready = missing.length === 0;
  // Cosa manca nel passo corrente (il consenso è l'ultimo): il pulsante si accende passo per passo.
  const stepMissing = flow.index === 0 ? missing.filter((m) => m.startsWith("scrivi")) : flow.index === 1 ? missing.filter((m) => m.startsWith("scegli il file")) : missing.filter((m) => m.startsWith("dai"));
  const stepReady = stepMissing.length === 0;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stepReady) return;
    if (!flow.isLast) {
      track("form_step_completed", { flow: "personal_import", step: flow.index + 1 });
      flow.next();
      return;
    }
    if (ready) upload.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <StepProgress index={flow.index} count={flow.count} label="Passi dell'importazione" />
      <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-4">
        {flow.index === 0 ? (
        <>
          <StepHeading title="Da dove arriva il file?" description={formats.length > 0 ? "Scegli un formato che hai già creato, oppure descrivine uno nuovo." : "Il nome della tua banca o del tuo broker: serve a riconoscere il formato la prossima volta."} />
          {formats.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-format`} className="text-sm font-medium text-foreground">Formato</label>
              <Select value={formatId} onValueChange={(value) => { setFormatId(value as string); setRegenerate(false); }}>
                <SelectTrigger id={`${id}-format`} className={cn("w-full", FIELD_CLASS)}>
                  <SelectValue>{(value: string | null) => (value === NEW_FORMAT || !value ? "Nuova banca o broker" : formats.find((f) => f.id === value)?.name ?? "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_FORMAT}>Nuova banca o broker</SelectItem>
                  {formats.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {isNew ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-name`} className="text-sm font-medium text-foreground">Nome della banca o del broker</label>
              <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Banca Sella" maxLength={80} autoComplete="off" className={FIELD_CLASS} />
            </div>
          ) : (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={regenerate} onChange={(e) => setRegenerate(e.target.checked)} />
              <span>Rileggi il formato con l&apos;AI <span className="text-muted-foreground">(se il file è cambiato o il risultato precedente non era giusto)</span></span>
            </label>
          )}
        </>
      ) : null}

        {flow.index === 1 ? (
        <>
          <StepHeading title="Carica il file" description={`CSV o Excel (.xlsx), fino a ${formatFileSize(PERSONAL_IMPORT_MAX_BYTES)} e ${PERSONAL_IMPORT_MAX_ROWS.toLocaleString("it-IT")} righe.`} />
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true"><FileSpreadsheetIcon className="size-5" /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(file.size)} · pronto</span>
              </span>
              <button type="button" onClick={() => { setFile(null); setFileError(null); }} aria-label={`Rimuovi ${file.name}`} className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9">
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label
              htmlFor={`${id}-file`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void pick(e.dataTransfer.files); }}
              className={cn("flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50", dragging && "border-primary bg-primary/5")}
            >
              <UploadIcon className="size-6 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{reading ? "Leggo il file…" : "Scegli un file"}</span>
              <span className="text-xs text-muted-foreground">{reading ? "Un attimo" : "oppure trascinalo qui"}</span>
              <input id={`${id}-file`} type="file" disabled={reading} accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-describedby={fileError ? `${id}-file-error` : undefined} onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} />
            </label>
          )}
          {fileError ? (
            <div className="flex flex-col items-start gap-0.5">
              <p id={`${id}-file-error`} role="alert" className="text-sm text-destructive">{fileError}</p>
              <ReportErrorLink area="Importazione movimenti: file non accettato" error={fileError} />
            </div>
          ) : null}
        </>
      ) : null}

        {flow.index === 2 ? (
        <>
          <StepHeading title="Ultimo passo: il consenso" description="Per capire le colonne di un formato nuovo, il file viene letto da un modello AI." />
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Acconsento all&apos;analisi AI del file. Se riuso un formato già creato, nessun dato va all&apos;AI.</span>
          </label>
          <details className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
            <summary className="min-h-9 cursor-pointer font-medium text-foreground">Cosa succede ai tuoi dati</summary>
            <div className="mt-2 flex flex-col gap-2">
              <p>Il file originale completo è inviato a OpenRouter e al modello configurato, con fornitori senza conservazione dei dati. Può contenere descrizioni, dati finanziari ed eventuali dati personali presenti nel file.</p>
              <p>File e anteprima sono cifrati e restano disponibili per 7 giorni; il file originale viene eliminato al termine dell&apos;analisi. Il formato che ne ricaviamo è privato. Pagamenti e investimenti si salvano da soli al termine dei controlli.</p>
            </div>
          </details>
        </>
      ) : null}
      </StepStage>

      <div className="flex flex-col gap-2">
        <StepActions
          backLabel={flow.isFirst ? undefined : "Indietro"}
          onBack={() => {
            track("form_step_back", { flow: "personal_import", step: flow.index + 1 });
            flow.back();
          }}
          primaryLabel={flow.isLast ? (upload.isPending ? "Carico il file…" : "Importa il file") : "Continua"}
          pending={upload.isPending}
          disabled={!stepReady}
        />
        {!stepReady ? <p id={`${id}-missing`} className="text-sm text-muted-foreground">Per continuare: {stepMissing.join(", ")}.</p> : null}
        {upload.error ? (
          <div className="flex flex-col items-start gap-0.5">
            <p role="alert" className="text-sm text-destructive">{upload.error.message}</p>
            <ReportErrorLink area="Importazione movimenti: caricamento non riuscito" error={upload.error.message} />
          </div>
        ) : null}
      </div>
    </form>
  );
}
