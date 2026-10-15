"use client";


import { useLocalization } from "@/lib/localization/provider";

/**
 * Schermata «File ricevuto» dopo l'invio di un CSV personale: conferma che il file è in lista, mostra in che fase è
 * (dallo stato vero del lavoro), il risultato a lavoro finito e dove andare dopo.
 */

import Link from "next/link";
import * as React from "react";
import { AlertCircleIcon, CheckCircle2Icon, CheckIcon, CircleDashedIcon, FileSpreadsheetIcon, LoaderCircleIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { TextShimmer } from "@/components/motion";
import { ProgressBar } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import type { PersonalImportListing } from "@/lib/queries/personal-imports";
import { cn } from "@/lib/utils";
import { formatFileSize } from "./personal-import-upload";
import { ReportErrorLink } from "@/components/domain/support";

type Job = PersonalImportListing["jobs"][number];

/** Cosa si sa del file appena inviato (letto nel browser prima dell'invio). */
export interface PersonalImportReceiptFile {
  name: string;
  /** Peso e righe, noti solo subito dopo l'invio (non si conservano sul server). */
  size?: number;
  rows?: number;
  /** Nome della banca o del broker scelto. */
  source: string;
}

export interface PersonalImportReceiptProps {
  file: PersonalImportReceiptFile;
  /** Lavoro corrispondente nell'elenco; assente per qualche istante dopo l'invio. */
  job: Job | undefined;
  /** Id della sezione «Le tue importazioni», raggiunta dal pulsante. */
  listId: string;
  onAnother: () => void;
}

const STAGES = ["File ricevuto", "Analisi del formato", "Controlli e salvataggio", "Importato"] as const;
/** I link-pulsante hanno l'altezza da dito su mobile come gli altri controlli del modulo. */
const LINK_CLASS = "h-11 sm:h-8";
const FAILED = ["failed", "review_failed", "expired"];

/** Fase attuale (indice in STAGES) dallo stato del lavoro; `queued` e `processing` sono entrambe «analisi». */
export function receiptStage(status: string | undefined): number {
  if (status === "imported") return STAGES.length;
  if (status === "ready") return 2;
  if (status === "processing" || status === "queued") return 1;
  return 1;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/** Elenco delle fasi con icona: fatta, in corso, in attesa. */
function Stages({ stage, failed }: { stage: number; failed: boolean }) {
  const { t: tr } = useLocalization();
  return (
    <ol aria-label={tr("Avanzamento dell'importazione")} className="flex flex-col gap-2.5">
      {STAGES.map((label, i) => {
        const done = i < stage;
        const active = i === stage && !failed;
        const Icon = done ? CheckIcon : active ? LoaderCircleIcon : CircleDashedIcon;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className={cn("flex items-center gap-3 text-sm", done || active ? "text-foreground" : "text-muted-foreground")}>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", done ? "bg-pos-soft text-pos" : "bg-muted")} aria-hidden="true">
              <Icon className={cn("size-3.5", active && "animate-spin motion-reduce:animate-none")} />
            </span>
            <span className={active ? "font-medium" : undefined}>{active ? <TextShimmer>{tr(label)}{"…"}</TextShimmer> : label}</span>
            <span className="sr-only">{done ? tr("fatto") : active ? tr("in corso") : tr("in attesa")}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** «File ricevuto»: nome, righe e fase; a fine lavoro il riepilogo e i link ai dati. */
export function PersonalImportReceipt({ file, job, listId, onAnother }: PersonalImportReceiptProps) {
  const { locale: formattingLocale } = useLocalization();

  const { t: tr } = useLocalization();
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const imported = job?.status === "imported";
  const failed = !!job && FAILED.includes(job.status);
  const stage = receiptStage(job?.status);
  const results = job?.results;
  const title = imported ? tr("Importazione completata") : failed ? tr("Non siamo riusciti a importare il file") : tr("File ricevuto");
  const Icon = failed ? AlertCircleIcon : CheckCircle2Icon;

  return (
    <section aria-labelledby={`${listId}-receipt`} className="flex flex-col gap-5 rounded-2xl border p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 size-6 shrink-0", failed ? "text-destructive" : "text-pos")} aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={`${listId}-receipt`} ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-medium tracking-tight outline-none">{tr(title)}</h2>
          <p role="status" className="text-sm text-muted-foreground">
            {imported
              ? tr("I dati sono già nel tuo conto.")
              : failed
                ? job?.error ?? tr("Puoi riprovare con un altro file, oppure aprire il dettaglio dalla lista.")
                : tr("L'abbiamo aggiunto alla lista delle tue importazioni e lo stiamo elaborando.")}
          </p>
          {failed ? <ReportErrorLink area="import_movimenti" error={job?.error ?? title} /> : null}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-muted-foreground" aria-hidden="true"><FileSpreadsheetIcon className="size-5" /></span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
          <span className="text-xs text-muted-foreground">{[file.source, file.size !== undefined ? formatFileSize(file.size) : null, file.rows !== undefined ? plural(file.rows, "riga", tr("righe")) : null].filter(Boolean).join(" · ")}</span>
        </span>
      </div>

      <Stages stage={stage} failed={failed} />
      {!imported && !failed ? <ProgressBar state={{ kind: "indeterminate" }} label={tr("Importazione in corso")} /> : null}

      {imported && results ? (
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li>{plural(results.cash, tr("movimento aggiunto"), tr("movimenti aggiunti"))}{" "}{tr("a Liquidità.")}</li>
          <li>{plural(results.investments, tr("operazione aggiunta"), tr("operazioni aggiunte"))}{" "}{tr("a Investimenti.")}</li>
          {results.skipped > 0 ? <li>{results.skipped === 1 ? tr("1 riga non riconosciuta è stata saltata, come hai scelto: non entra nei conti.") : tr("{0} righe non riconosciute sono state saltate, come hai scelto: non entrano nei conti.", { 0: results.skipped })}</li> : null}
          <li>{tr("Le righe già presenti sono state saltate, senza doppioni.")}</li>
        </ul>
      ) : null}

      {!imported && !failed ? (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p className="text-foreground">{tr("Puoi chiudere questa pagina: ti scriviamo un'email appena abbiamo finito.")}</p>
          {job ? <p>{tr("Stima: entro il")}{" "}{new Date(job.estimatedAt).toLocaleString(formattingLocale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}{tr(". È una stima, non una scadenza garantita.")}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {imported ? (
          <>
            {results && results.cash > 0 ? <Link href="/liquidita" onClick={() => track("personal_csv_receipt_action", { action: "vai_ai_dati" })} className={buttonVariants({ className: LINK_CLASS })}>{tr("Vai a Liquidità")}</Link> : null}
            {results && results.investments > 0 ? <Link href="/investimenti/operazioni" onClick={() => track("personal_csv_receipt_action", { action: "vai_ai_dati" })} className={buttonVariants({ variant: results.cash > 0 ? "outline" : "default", className: LINK_CLASS })}>{tr("Vai alle operazioni")}</Link> : null}
          </>
        ) : null}
        <a href={`#${listId}`} onClick={() => track("personal_csv_receipt_action", { action: "lista" })} className={buttonVariants({ variant: "outline", className: LINK_CLASS })}>{tr("Vedi le tue importazioni")}</a>
        <Button variant="ghost" className="h-11 sm:h-8" onClick={() => { track("personal_csv_receipt_action", { action: "altro_file" }); onAnother(); }}>{tr("Carica un altro file")}</Button>
      </div>
    </section>
  );
}
