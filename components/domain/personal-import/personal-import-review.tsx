"use client";

import { useLocalization } from "@/lib/localization/provider";
import { translateServerMessage } from "@/lib/localization/messages";

/**
 * Schermata «Righe da controllare» di un CSV personale: quante righe non sono state riconosciute e perché (raggruppate per
 * motivo, con numero di riga e testo originale), e le tre strade possibili: importare le righe riconosciute saltando le
 * altre, rianalizzare il file con l'AI senza ricaricarlo, caricare un file corretto. Sotto, tutte le righe per esito.
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, FileSpreadsheetIcon, ListChecksIcon, SparklesIcon, UploadIcon, WandSparklesIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PanelSection } from "@/components/domain/investments/light";
import { ErrorWithReport, ReportErrorLink } from "@/components/domain/support";
import { usePrivacy } from "@/components/privacy-provider";
import { track } from "@/lib/analytics";
import type { Preview } from "@/lib/personal-import/confirm";
import { groupPreviewRecords } from "@/lib/personal-import/preview-groups";
import { groupErrorsByReason, sourceLine, sourceText, type ErrorReasonGroup } from "@/lib/personal-import/review-groups";
import type { PersonalImportListing } from "@/lib/queries/personal-imports";
import { cn } from "@/lib/utils";
import { personalImportApi } from "./personal-import-api";
import { PersonalImportRows } from "./personal-import-rows";
import type { PersonalImportReceiptFile } from "./personal-import-receipt";
import { formatFileSize } from "./personal-import-upload";

type Job = PersonalImportListing["jobs"][number];

/** Righe mostrate per motivo prima di «Mostra tutte». */
const ROWS_PER_REASON = 5;
const CONSENT_VERSION = "openrouter-raw-zdr-v3";
const BUTTON_CLASS = "h-11 sm:h-9";

export interface PersonalImportReviewProps {
  job: Job;
  file: PersonalImportReceiptFile;
  /** Id della sezione «Le tue importazioni». */
  listId: string;
  /** «Carica un file corretto»: torna al modulo di caricamento. */
  onUploadCorrected: () => void;
  /** Rianalisi avviata: il nuovo lavoro prende il posto di questo. */
  onReanalyzed: (jobId: string) => void;
}

/** Un motivo e le sue righe: numero di riga nel file e testo originale (nascosto con «Nascondi gli importi»). */
function ReasonGroup({ group, hidden }: { group: ErrorReasonGroup; hidden: boolean }) {
  const { t: tr, language } = useLocalization();
  const [all, setAll] = React.useState(false);
  const rows = all ? group.records : group.records.slice(0, ROWS_PER_REASON);
  const count = group.records.length;
  return (
    <li className="flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium text-foreground">
        {translateServerMessage(language, group.reason)}
        <span className="ml-2 font-normal text-muted-foreground">{count === 1 ? tr("1 riga") : tr("{0} righe", { 0: count })}</span>
      </p>
      <ol className="flex flex-col gap-1.5">
        {rows.map((record) => (
          <li key={record.key} className="grid grid-cols-[4.25rem_1fr] gap-x-2 text-xs">
            <span className="text-muted-foreground tabular-nums">{tr("Riga {0}", { 0: sourceLine(record) })}</span>
            <code className={cn("min-w-0 break-all rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] leading-relaxed text-foreground", hidden && "text-muted-foreground")}>{hidden ? tr("(nascosta)") : sourceText(record) || tr("(riga vuota)")}</code>
          </li>
        ))}
      </ol>
      {count > ROWS_PER_REASON && !all ? (
        <button type="button" onClick={() => setAll(true)} className="self-start text-xs font-medium text-primary hover:underline">{tr("Mostra tutte le {0} righe", { 0: count })}</button>
      ) : null}
    </li>
  );
}

export function PersonalImportReview({ job, file, listId, onUploadCorrected, onReanalyzed }: PersonalImportReviewProps) {
  const { t: tr, locale, language } = useLocalization();
  const { hidden } = usePrivacy();
  const client = useQueryClient();
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => { headingRef.current?.focus(); }, []);
  const { data, error, isPending } = useQuery({ queryKey: ["personal-import-preview", job.id], queryFn: () => personalImportApi<Preview>(`/${job.id}`), staleTime: 0 });

  const skip = useMutation({
    mutationFn: () => personalImportApi<{ inserted: number; skipped?: number }>(`/${job.id}`, { action: "import_skipping_errors" }),
    onSuccess: (result) => {
      track("personal_csv_imported", { rows: result.inserted, skipped: result.skipped ?? 0 });
      void client.invalidateQueries({ queryKey: ["personal-imports"] });
    },
  });
  const reanalyze = useMutation({
    mutationFn: () => personalImportApi<{ id: string }>(`/${job.id}`, { action: "reanalyze", consent: true, consentVersion: CONSENT_VERSION }),
    onSuccess: (result) => {
      track("personal_csv_review_action", { action: "rianalizza" });
      void client.invalidateQueries({ queryKey: ["personal-imports"] });
      onReanalyzed(result.id);
    },
  });

  const groups = data ? groupPreviewRecords(data.records) : null;
  const errors = groups?.errors.length ?? 0;
  const importable = groups ? groups.cash + groups.investments : 0;
  const total = data?.records.length ?? 0;
  const reasons = groups ? groupErrorsByReason(groups.errors) : [];
  // Senza righe in errore il blocco viene dai controlli finali (es. vendite senza acquisti): resta il messaggio del lavoro.
  const rowProblem = errors > 0;
  const title = rowProblem ? (errors === 1 ? tr("1 riga da controllare") : tr("{0} righe da controllare", { 0: errors })) : tr("Non siamo riusciti a importare il file");
  const busy = skip.isPending || reanalyze.isPending;

  return (
    <section aria-labelledby={`${listId}-review`} className="flex flex-col gap-5 rounded-2xl bg-card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 size-6 shrink-0" style={{ color: "var(--swatch-amber)" }} aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={`${listId}-review`} ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-medium tracking-tight outline-none">{isPending ? tr("Controllo le righe…") : title}</h2>
          <p role="status" className="text-sm text-muted-foreground">
            {isPending
              ? tr("Un attimo: leggo l'esito dell'analisi.")
              : rowProblem
                ? tr("Su {0} righe lette, {1} sono pronte e {2} non le ho capite. Non ho salvato nulla: scegli tu cosa fare.", { 0: total, 1: importable, 2: errors })
                : (job.error ? translateServerMessage(language, job.error) : null) ?? tr("Puoi riprovare con un altro file, oppure aprire il dettaglio dalla lista.")}
          </p>
          <ReportErrorLink area="import_movimenti" error={job.error ?? title} />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-muted-foreground" aria-hidden="true"><FileSpreadsheetIcon className="size-5" /></span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
          <span className="text-xs text-muted-foreground">{[file.source, file.size !== undefined ? formatFileSize(file.size, locale) : null, total ? tr("{0} righe lette", { 0: total }) : null].filter(Boolean).join(" · ")}</span>
        </span>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error.message}</p> : null}

      {data && groups ? (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">{tr("Cosa puoi fare")}</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {rowProblem && importable > 0 ? (
                <AlertDialog>
                  <AlertDialogTrigger render={<Button className={BUTTON_CLASS} disabled={busy} />}>
                    <ListChecksIcon className="size-4" aria-hidden="true" />
                    {importable === 1 ? tr("Importa la riga riconosciuta") : tr("Importa le {0} righe riconosciute", { 0: importable })}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{tr("Importare saltando {0} righe?", { 0: errors })}</AlertDialogTitle>
                      <AlertDialogDescription>{tr("Salvo le {0} righe riconosciute e salto le altre {1}: non entrano nei conti. Potrai correggerle nel file e ricaricarlo più avanti, senza doppioni. Il formato resta salvato per i prossimi file.", { 0: importable, 1: errors })}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tr("Annulla")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => { track("personal_csv_review_action", { action: "importa_saltando" }); skip.mutate(); }}>{tr("Importa e salta")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant={rowProblem && importable > 0 ? "outline" : "default"} className={BUTTON_CLASS} disabled={busy} />}>
                  <WandSparklesIcon className="size-4" aria-hidden="true" />
                  {reanalyze.isPending ? tr("Rianalizzo…") : tr("Rianalizza con l'AI")}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{tr("Rianalizzare il file con l'AI?")}</AlertDialogTitle>
                    <AlertDialogDescription>{tr("Il file viene letto di nuovo dal modello AI, come al primo caricamento, per ricavare un formato migliore. Non devi ricaricarlo e non salvo nulla finché i controlli non passano. Utile se le righe segnalate ti sembrano giuste.")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tr("Annulla")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => reanalyze.mutate()}>{tr("Rianalizza")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="ghost" className={BUTTON_CLASS} disabled={busy} onClick={() => { track("personal_csv_review_action", { action: "file_corretto" }); onUploadCorrected(); }}>
                <UploadIcon className="size-4" aria-hidden="true" />
                {tr("Carica un file corretto")}
              </Button>
            </div>
            {skip.error ? <ErrorWithReport area="import_movimenti" error={skip.error.message} /> : null}
            {reanalyze.error ? <ErrorWithReport area="import_movimenti" error={reanalyze.error.message} /> : null}
          </div>

          {rowProblem ? (
            <PanelSection icon={AlertTriangleIcon} title={tr("Cosa non va")} color="var(--swatch-amber)" description={tr("Il numero è la riga del file originale (l'intestazione è la riga 1). Apri il file, cerca la riga e confronta con il motivo.")}>
              <ol className="flex flex-col">
                {reasons.map((group) => <ReasonGroup key={group.reason} group={group} hidden={hidden} />)}
              </ol>
            </PanelSection>
          ) : null}

          <PersonalImportRows preview={data} groups={groups} />

          <details className="text-sm text-muted-foreground">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-foreground"><SparklesIcon className="size-4 text-muted-foreground" aria-hidden="true" />{tr("Perché succede e come correggere")}</summary>
            <ul className="flex list-disc flex-col gap-1.5 pb-2 pl-5">
              <li>{tr("Il formato del file viene ricavato dall'AI alla prima lettura: a volte sbaglia su righe insolite (note, totali, movimenti di tipo raro). Se le righe segnalate ti sembrano normali, «Rianalizza con l'AI» di solito basta.")}</li>
              <li>{tr("Se il motivo parla di data o importo, controlla che nel file siano scritti come nelle altre righe (stesso separatore decimale, stessa forma della data).")}</li>
              <li>{tr("Se poche righe non ti servono, importa le altre: le righe saltate non entrano nei conti e potrai aggiungerle a mano o ricaricarle corrette.")}</li>
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}
