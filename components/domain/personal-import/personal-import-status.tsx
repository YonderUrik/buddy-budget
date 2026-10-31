"use client";


import { importOverlap } from "@/lib/personal-import/counts";
import { useLocalization } from "@/lib/localization/provider";
import { translateServerMessage } from "@/lib/localization/messages";

/** Avanzamento di un'importazione personale (analisi → salvataggio → fatto) e elenco dei file caricati. */

import Link from "next/link";
import { AlertCircleIcon, CheckIcon, ChevronRightIcon, CheckCircle2, Clock3, FileSpreadsheetIcon, ListChecksIcon, LoaderCircleIcon } from "lucide-react";
import { TextShimmer } from "@/components/motion";
import { ProgressBar } from "@/components/domain/shared";
import { DialogSteps, PanelSection } from "@/components/domain/investments/light";
import { islandState } from "@/lib/personal-import/island";
import { type PersonalImportListing } from "@/lib/queries/personal-imports";
import { cn } from "@/lib/utils";

type Job = PersonalImportListing["jobs"][number];

export const PERSONAL_IMPORT_ACTIVE = ["queued", "processing", "ready"] as const;
const STEPS = ["Analisi del file", "Controlli e salvataggio", "Fatto"] as const;

export function isActiveJob(job: Job | undefined): boolean {
  return !!job && (PERSONAL_IMPORT_ACTIVE as readonly string[]).includes(job.status);
}

export interface PersonalImportProgressProps {
  job: Job;
}

/** Cosa sta succedendo al file scelto, con i passi e la stima. Annunciato come `status`. */
export function PersonalImportProgress({ job }: PersonalImportProgressProps) {
  const { locale: formattingLocale } = useLocalization();

  const { t: tr } = useLocalization();
  const late = new Date(job.estimatedAt) < new Date();
  if (job.status === "imported") {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-xl bg-pos-soft p-4">
        <p className="flex items-center gap-2 font-medium text-foreground"><CheckCircle2 className="size-5 text-pos" aria-hidden="true" />{" "}{tr("Importazione completata.")}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link href="/liquidita" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">{tr("Vai a Liquidità")}</Link>
          <Link href="/investimenti/operazioni" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">{tr("Vai alle operazioni")}</Link>
        </div>
      </div>
    );
  }
  const step = job.status === "ready" ? 1 : 0;
  return (
    <PanelSection icon={Clock3} title={step === 1 ? tr("Stiamo salvando le tue operazioni") : tr("Stiamo analizzando il tuo file")} color="var(--swatch-indigo)" description={tr("Controlliamo importi, date e doppioni prima di salvare. I dati compariranno in Liquidità e Investimenti.")}>
      <DialogSteps steps={STEPS} current={step} ariaLabel={tr("Avanzamento dell'importazione")} className="max-sm:hidden" />
      <div role="status" className="flex flex-col gap-1.5 text-sm">
        <p className="font-medium text-foreground sm:font-normal">{tr("Puoi chiudere questa pagina: ti scriviamo un'email appena abbiamo finito.")}</p>
        <p className="text-muted-foreground">{tr("Stima: circa 1 ora, entro il")}{" "}{new Intl.DateTimeFormat(formattingLocale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(job.estimatedAt))}{tr(". È una stima, non una scadenza garantita.")}</p>
        {late ? <p className="text-foreground">{tr("Sta richiedendo più tempo del previsto. Ti avvisiamo appena è pronto.")}</p> : null}
      </div>
    </PanelSection>
  );
}

export interface PersonalImportListProps {
  listing: { data?: PersonalImportListing; isPending: boolean; error: Error | null };
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** «Riprova» sulle importazioni non riuscite: porta al modulo di caricamento. */
  onRetry?: () => void;
}

/** Italian source text of the read in progress (translated by the caller), or null when nothing is being read. */
export function describeProgress(progress: Job["progress"]): string | null {
  if (!progress) return null;
  if (progress.kind === "saved") return "Leggo il file con il formato già salvato";
  if (progress.attempt <= 1) return "Analizzo il formato con l'AI (tentativo 1 di 3)";
  if (progress.attempt === 2) return "Riprovo con più contesto (tentativo 2 di 3)";
  return "Ultimo tentativo, il più approfondito (3 di 3): può richiedere qualche minuto";
}

/** What a row says, in plain words, from the job state: Italian source texts with their `{0}` values, translated by the list. */
export function describeImportJob(job: Job): { message: string; values?: Record<string, number>; action: string | null } {
  switch (job.status) {
    case "queued":
    case "processing": return { message: describeProgress(job.progress) ?? "Analisi in corso", action: null };
    case "ready": return { message: "Salvataggio in corso", action: null };
    case "imported": return job.results
      ? importOverlap(job.results) === "nothing_new"
        ? { message: "Niente di nuovo: {0} movimenti c'erano già", values: { 0: job.results.alreadyPresent! }, action: "Dettaglio" }
        : importOverlap(job.results) === "partial"
          ? { message: "{0} su {1} movimenti importati", values: { 0: job.results.rows! - job.results.alreadyPresent!, 1: job.results.rows! }, action: "Dettaglio" }
          : { message: "{0} movimenti · {1} operazioni", values: { 0: job.results.cash, 1: job.results.investments }, action: "Dettaglio" }
      : { message: "Importato", action: "Dettaglio" };
    case "failed": return { message: job.error ?? "Formato non riconosciuto", action: "Riprova" };
    case "expired": return { message: "File scaduto: caricalo di nuovo", action: "Riprova" };
    default: return { message: job.status, action: null };
  }
}



function StatusIcon({ state }: { state: ReturnType<typeof islandState> }) {
  if (state === "running") return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><LoaderCircleIcon className="size-4 motion-safe:animate-spin" aria-hidden="true" /></span>;
  if (state === "done") return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pos-soft text-pos"><CheckIcon className="size-4" aria-hidden="true" /></span>;
  return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neg-soft text-neg"><AlertCircleIcon className="size-4" aria-hidden="true" /></span>;
}

/** «Le tue importazioni»: una riga per file (più recenti prima) con stato in chiaro e una sola azione; la riga scelta ha `aria-current`. */
export function PersonalImportList({ listing, selectedId, onSelect, onRetry }: PersonalImportListProps) {
  const { locale: formattingLocale } = useLocalization();
  function dayLabel(iso: string): string {
  const date = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return tr("oggi {0}", { 0: date.toLocaleTimeString(formattingLocale, { hour: "2-digit", minute: "2-digit" }) });
  if (days === 1) return tr("ieri");
  return date.toLocaleDateString(formattingLocale, { day: "numeric", month: "short" });
}

  const { t: tr, language } = useLocalization();
  const jobs = listing.data?.jobs ?? [];
  const formats = listing.data?.formats ?? [];
  return (
    <PanelSection icon={ListChecksIcon} title={tr("Le tue importazioni")} color="var(--swatch-slate)">
      {listing.isPending ? <p role="status" className="text-sm text-muted-foreground">{tr("Caricamento…")}</p> : null}
      {listing.error ? <p role="alert" className="text-sm text-destructive">{tr(listing.error.message)}</p> : null}
      {jobs.length === 0 && !listing.isPending && !listing.error ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <FileSpreadsheetIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{tr("Nessun file caricato")}</p>
          <p className="text-sm text-muted-foreground">{tr("Quando carichi un file lo trovi qui, con il suo stato.")}</p>
        </div>
      ) : null}
      {jobs.length > 0 ? (
        <ul className="flex flex-col">
          {jobs.map((job) => {
            const state = islandState(job);
            const { message: source, values, action } = describeImportJob(job);
            const message = values ? tr(source, values) : translateServerMessage(language, source);
            const name = formats.find((f) => f.id === job.formatId)?.name ?? tr("File");
            const retry = action === "Riprova";
            const body = (
              <>
                <StatusIcon state={state} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-baseline gap-2"><span className="truncate text-sm font-medium text-foreground">{name}</span><span className="shrink-0 text-xs text-muted-foreground">{dayLabel(job.createdAt)}</span></span>
                  <span className={cn("truncate text-sm", state === "failed" ? "text-neg" : "text-muted-foreground")}>{state === "running" ? <TextShimmer>{message}</TextShimmer> : message}</span>
                </span>
                {action ? <span className="hidden shrink-0 text-sm font-medium text-primary sm:inline">{tr(action)}</span> : null}
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground sm:hidden" aria-hidden="true" />
              </>
            );
            const rowClass = cn("flex min-h-14 w-full items-center gap-3 py-3 text-left hover:bg-muted/40", selectedId === job.id && "bg-muted/40");
            return (
              <li key={job.id}>
                <button type="button" onClick={() => (retry && onRetry ? onRetry() : onSelect(job.id))} aria-current={selectedId === job.id ? "true" : undefined} className={cn(rowClass, "cursor-pointer")}>{body}</button>
                {state === "running" ? <ProgressBar state={{ kind: "indeterminate" }} label={tr("Importazione {0} in corso", {0: name})} className="mb-3 ml-11 w-auto" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </PanelSection>
  );
}
