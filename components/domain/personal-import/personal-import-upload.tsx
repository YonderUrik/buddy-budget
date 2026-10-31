"use client";


import { useLocalization } from "@/lib/localization/provider";
import { translateServerMessage } from "@/lib/localization/messages";

/**
 * Upload form for personal CSV or Excel files, in three steps: where they come from, the files, consent to the AI
 * analysis. Several exports of the same bank go in one upload (`personal-import-batch.ts`). An Excel file becomes CSV
 * text in the browser (same reader as Pensione and Investimenti); the server always receives CSV.
 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheetIcon, InfoIcon, UploadIcon, XIcon } from "lucide-react";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import { gridToCsv } from "@/lib/investments/import/fineco";
import { readXlsx, XLSX_MAX_FILE_BYTES } from "@/lib/pension/import/xlsx";
import { cn } from "@/lib/utils";
import { PersonalImportApiError, personalImportApi } from "./personal-import-api";
import { addFiles, PERSONAL_IMPORT_MAX_FILES, sendBatch, type BatchResult } from "./personal-import-batch";
import type { PersonalImportReceiptFile } from "./personal-import-receipt";
import { ErrorWithReport } from "@/components/domain/support";

export const PERSONAL_IMPORT_MAX_BYTES = 25 * 1024 * 1024;
export const PERSONAL_IMPORT_MAX_ROWS = 50_000;
const CONSENT_VERSION = "openrouter-raw-zdr-v3";
/** The server's text for a file already imported (`ALREADY_IMPORTED_MESSAGE`), shown when it is the only file sent. */
const ALREADY_IMPORTED_TEXT = "Questo file è già stato importato: i suoi movimenti ci sono già tutti.";
const NEW_FORMAT = "__new__";
const FIELD_CLASS = "h-11 sm:h-9";
const PERSONAL_IMPORT_STEPS = 3;

interface LoadedFile {
  name: string;
  size: number;
  csv: string;
}

/** Human-readable file size (KB or MB), with the decimal separator of `locale`. */
export function formatFileSize(bytes: number, locale = "it-IT"): string {
  return bytes >= 1024 * 1024 ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  /** Called with the jobs created, in upload order, and a summary of the files sent. */
  onQueued: (jobIds: string[], file: PersonalImportReceiptFile) => void;
}

export function PersonalImportUpload({ formats, onQueued }: PersonalImportUploadProps) {
  const { locale: formattingLocale } = useLocalization();
  function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? tr("{0} MB", { 0: new Intl.NumberFormat(formattingLocale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024) }) : tr("{0} KB", { 0: Math.max(1, Math.round(bytes / 1024)) });
}
  async function readPersonalImportFile(file: File): Promise<LoadedFile> {
  if (/\.xlsx$/i.test(file.name)) {
    if (file.size > XLSX_MAX_FILE_BYTES) throw new Error(tr("Il file Excel pesa {0}: il massimo è {1}. Esporta il foglio in CSV e riprova.", { 0: formatFileSize(file.size), 1: formatFileSize(XLSX_MAX_FILE_BYTES) }));
    const sheet = readXlsx(new Uint8Array(await file.arrayBuffer()));
    return { name: file.name, size: file.size, csv: gridToCsv([sheet.headers, ...sheet.rows]) };
  }
  if (/\.xls$/i.test(file.name)) throw new Error(tr("I file .xls (Excel antico) non si leggono. In Excel scegli «Salva con nome» e poi «Cartella di lavoro di Excel (.xlsx)» o «CSV»."));
  if (file.size > PERSONAL_IMPORT_MAX_BYTES) throw new Error(tr("Il file pesa {0}: il massimo è {1}.", { 0: formatFileSize(file.size), 1: formatFileSize(PERSONAL_IMPORT_MAX_BYTES) }));
  return { name: file.name, size: file.size, csv: await file.text() };
}

  const { t: tr, language } = useLocalization();
  const id = React.useId();
  const flow = useStepFlow(PERSONAL_IMPORT_STEPS);
  const client = useQueryClient();
  const [formatId, setFormatId] = React.useState(NEW_FORMAT);
  const [name, setName] = React.useState("");
  const [files, setFiles] = React.useState<LoadedFile[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const [regenerate, setRegenerate] = React.useState(false);
  const isNew = formatId === NEW_FORMAT;

  const [outcome, setOutcome] = React.useState<BatchResult<LoadedFile> | null>(null);
  const isAlreadyImported = (error: unknown) => error instanceof PersonalImportApiError && error.code === "already_imported";
  const upload = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error(tr("Scegli un file da importare."));
      const source = formats.find((f) => f.id === formatId)?.name ?? name.trim();
      return sendBatch(files, isNew ? undefined : formatId, (file, target) => personalImportApi<{ id: string; formatId?: string }>("", { name: source, csv: file.csv, formatId: target, regenerate, consent, consentVersion: CONSENT_VERSION }), isAlreadyImported);
    },
    onSuccess: (result) => {
      setOutcome(result);
      for (let i = 0; i < result.alreadyImported.length; i++) track("personal_csv_already_imported", { stage: "caricamento" });
      if (!result.queued.length) return;
      track("personal_csv_requested", { reuse: !isNew, files: result.queued.length });
      const sent = result.queued.map((q) => q.file);
      const source = formats.find((f) => f.id === formatId)?.name ?? name.trim();
      const summary: PersonalImportReceiptFile = sent.length === 1
        ? { name: sent[0].name, size: sent[0].size, rows: countCsvRows(sent[0].csv), source }
        : { name: tr("{0} file", { 0: sent.length }), size: sent.reduce((n, f) => n + f.size, 0), rows: sent.reduce((n, f) => n + countCsvRows(f.csv), 0), source };
      setFiles([]);
      setConsent(false);
      setRegenerate(false);
      void client.invalidateQueries({ queryKey: ["personal-imports"] });
      const skipped = [...result.alreadyImported.map((f) => f.name), ...result.failed.map((f) => f.file.name)];
      onQueued(result.queued.map((q) => q.id), skipped.length ? { ...summary, notice: tr("Non inviati: {0}. Gli altri sono in arrivo.", { 0: skipped.join(", ") }) } : summary);
    },
  });

  async function pick(list: FileList | null) {
    const chosen = [...(list ?? [])];
    if (!chosen.length || reading) return;
    setFileError(null);
    setOutcome(null);
    setReading(true);
    const loaded: LoadedFile[] = [];
    const unreadable: string[] = [];
    for (const file of chosen) {
      try { loaded.push(await readPersonalImportFile(file)); }
      catch (e) { unreadable.push(`${file.name}: ${e instanceof Error ? e.message : tr("Non riesco a leggere questo file.")}`); }
    }
    const { files: next, dropped } = addFiles(files, loaded);
    setFiles(next);
    if (dropped) unreadable.push(tr("Puoi caricare al massimo {0} file alla volta: {1} non aggiunti.", { 0: PERSONAL_IMPORT_MAX_FILES, 1: dropped }));
    if (unreadable.length) setFileError(unreadable.join(" "));
    setReading(false);
  }

  const missing: string[] = [];
  if (isNew && !name.trim()) missing.push("scrivi da dove arriva il file");
  if (!files.length) missing.push("scegli il file");
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
      <StepProgress index={flow.index} count={flow.count} label={tr("Passi dell'importazione")} />
      <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-4">
        {flow.index === 0 ? (
        <>
          <StepHeading title={tr("Da dove arriva il file?")} description={formats.length > 0 ? tr("Scegli un formato che hai già creato, oppure descrivine uno nuovo.") : tr("Il nome della tua banca o del tuo broker: serve a riconoscere il formato la prossima volta.")} />
          {formats.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-format`} className="text-sm font-medium text-foreground">{tr("Formato")}</label>
              <Select value={formatId} onValueChange={(value) => { setFormatId(value as string); setRegenerate(false); }}>
                <SelectTrigger id={`${id}-format`} className={cn("w-full", FIELD_CLASS)}>
                  <SelectValue>{(value: string | null) => (value === NEW_FORMAT || !value ? tr("Nuova banca o broker") : formats.find((f) => f.id === value)?.name ?? "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_FORMAT}>{tr("Nuova banca o broker")}</SelectItem>
                  {formats.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {isNew ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-name`} className="text-sm font-medium text-foreground">{tr("Nome della banca o del broker")}</label>
              <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Es. Banca Sella")} maxLength={80} autoComplete="off" className={FIELD_CLASS} />
            </div>
          ) : (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={regenerate} onChange={(e) => setRegenerate(e.target.checked)} />
              <span>{tr("Rileggi il formato con l'AI")}{" "}<span className="text-muted-foreground">{tr("(se il file è cambiato o il risultato precedente non era giusto)")}</span></span>
            </label>
          )}
        </>
      ) : null}

        {flow.index === 1 ? (
        <>
          <StepHeading title={tr("Carica i file")} description={tr("CSV o Excel (.xlsx), fino a {0} e {1} righe ciascuno. Puoi sceglierne fino a {2} della stessa banca.", {0: formatFileSize(PERSONAL_IMPORT_MAX_BYTES), 1: new Intl.NumberFormat(formattingLocale).format(PERSONAL_IMPORT_MAX_ROWS), 2: PERSONAL_IMPORT_MAX_FILES})} />
          {files.length ? (
            <ul className="flex flex-col gap-2" aria-label={tr("File scelti")}>
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true"><FileSpreadsheetIcon className="size-5" /></span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}{" "}{tr("· pronto")}</span>
                  </span>
                  <button type="button" onClick={() => { setFiles((current) => current.filter((f) => f !== file)); setFileError(null); }} aria-label={tr("Rimuovi {0}", {0: file.name})} className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9">
                    <XIcon className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {files.length < PERSONAL_IMPORT_MAX_FILES ? (
            <label
              htmlFor={`${id}-file`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void pick(e.dataTransfer.files); }}
              className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50", files.length ? "min-h-24" : "min-h-36", dragging && "border-primary bg-primary/5")}
            >
              <UploadIcon className="size-6 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{reading ? tr("Leggo i file…") : files.length ? tr("Aggiungi altri file") : tr("Scegli uno o più file")}</span>
              <span className="text-xs text-muted-foreground">{reading ? tr("Un attimo") : tr("oppure trascinali qui")}</span>
              <input id={`${id}-file`} type="file" multiple disabled={reading} accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-describedby={fileError ? `${id}-file-error` : undefined} onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} />
            </label>
          ) : null}
          {fileError ? (
            <div id={`${id}-file-error`}>
              <ErrorWithReport area="import_movimenti" error={fileError} />
            </div>
          ) : null}
        </>
      ) : null}

        {flow.index === 2 ? (
        <>
          <StepHeading title={tr("Ultimo passo: il consenso")} description={tr("Per capire le colonne di un formato nuovo, il file viene letto da un modello AI.")} />
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{tr("Acconsento all'analisi AI del file, anche automaticamente se il formato salvato non riesce a leggerlo.")}</span>
          </label>
          <details className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
            <summary className="min-h-9 cursor-pointer font-medium text-foreground">{tr("Cosa succede ai tuoi dati")}</summary>
            <div className="mt-2 flex flex-col gap-2">
              <p>{tr("Il file originale completo è inviato a OpenRouter e al modello configurato, con fornitori senza conservazione dei dati. Può contenere descrizioni, dati finanziari ed eventuali dati personali presenti nel file.")}</p>
              <p>{tr("File e anteprima sono cifrati e restano disponibili per 7 giorni; il file originale viene eliminato al termine dell'analisi. Il formato che ne ricaviamo è privato. Pagamenti e investimenti si salvano da soli al termine dei controlli.")}</p>
            </div>
          </details>
        </>
      ) : null}
      </StepStage>

      <div className="flex flex-col gap-2">
        <StepActions
          backLabel={flow.isFirst ? undefined : tr("Indietro")}
          onBack={() => {
            track("form_step_back", { flow: "personal_import", step: flow.index + 1 });
            flow.back();
          }}
          primaryLabel={flow.isLast ? (upload.isPending ? (files.length > 1 ? tr("Carico i file…") : tr("Carico il file…")) : files.length > 1 ? tr("Importa {0} file", { 0: files.length }) : tr("Importa il file")) : tr("Continua")}
          pending={upload.isPending}
          disabled={!stepReady}
        />
        {!stepReady ? <p id={`${id}-missing`} className="text-sm text-muted-foreground">{tr("Per continuare:")}{" "}{stepMissing.map((message) => tr(message)).join(", ")}{"."}</p> : null}
        {outcome?.alreadyImported.length ? (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm text-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {outcome.alreadyImported.length === 1 && outcome.queued.length === 0 && outcome.failed.length === 0
              ? translateServerMessage(language, ALREADY_IMPORTED_TEXT)
              : tr("Già importati, li ho saltati: {0}.", { 0: outcome.alreadyImported.map((f) => f.name).join(", ") })}
          </p>
        ) : null}
        {outcome?.failed.length ? <ErrorWithReport area="import_movimenti" error={outcome.failed.map((f) => `${f.file.name}: ${translateServerMessage(language, f.message)}`).join(" ")} /> : null}
        {upload.error ? <ErrorWithReport area="import_movimenti" error={upload.error.message} /> : null}
      </div>
    </form>
  );
}
