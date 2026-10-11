"use client";

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
  const late = new Date(job.estimatedAt) < new Date();
  if (job.status === "imported") {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-xl bg-pos-soft p-4">
        <p className="flex items-center gap-2 font-medium text-foreground"><CheckCircle2 className="size-5 text-pos" aria-hidden="true" /> Importazione completata.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link href="/liquidita" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">Vai a Liquidità</Link>
          <Link href="/investimenti/operazioni" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">Vai alle operazioni</Link>
        </div>
      </div>
    );
  }
  const step = job.status === "ready" ? 1 : 0;
  return (
    <PanelSection icon={Clock3} title={step === 1 ? "Stiamo salvando le tue operazioni" : "Stiamo analizzando il tuo file"} color="var(--swatch-indigo)" description="Controlliamo importi, date e doppioni prima di salvare. I dati compariranno in Liquidità e Investimenti.">
      <DialogSteps steps={STEPS} current={step} ariaLabel="Avanzamento dell'importazione" className="max-sm:hidden" />
      <div role="status" className="flex flex-col gap-1.5 text-sm">
        <p className="font-medium text-foreground sm:font-normal">Puoi chiudere questa pagina: ti scriviamo un&apos;email appena abbiamo finito.</p>
        <p className="text-muted-foreground">Stima: circa 1 ora, entro il {new Date(job.estimatedAt).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}. È una stima, non una scadenza garantita.</p>
        {late ? <p className="text-foreground">Sta richiedendo più tempo del previsto. Ti avvisiamo appena è pronto.</p> : null}
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

/** Cosa dice una riga, in parole semplici, dallo stato del lavoro. */
export function describeImportJob(job: Job): { message: string; action: string | null } {
  switch (job.status) {
    case "queued":
    case "processing": return { message: "Analisi in corso", action: null };
    case "ready": return { message: "Salvataggio in corso", action: null };
    case "imported": return { message: job.results ? `${job.results.cash} movimenti · ${job.results.investments} operazioni` : "Importato", action: "Dettaglio" };
    case "review_failed": return { message: job.error ?? "Qualche riga da correggere", action: "Controlla" };
    case "failed": return { message: job.error ?? "Formato non riconosciuto", action: "Riprova" };
    case "expired": return { message: "File scaduto: caricalo di nuovo", action: "Riprova" };
    default: return { message: job.status, action: null };
  }
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return `oggi ${date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "ieri";
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function StatusIcon({ state }: { state: ReturnType<typeof islandState> }) {
  if (state === "running") return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><LoaderCircleIcon className="size-4 motion-safe:animate-spin" aria-hidden="true" /></span>;
  if (state === "done") return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pos-soft text-pos"><CheckIcon className="size-4" aria-hidden="true" /></span>;
  return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neg-soft text-neg"><AlertCircleIcon className="size-4" aria-hidden="true" /></span>;
}

/** «Le tue importazioni»: una riga per file (più recenti prima) con stato in chiaro e una sola azione; la riga scelta ha `aria-current`. */
export function PersonalImportList({ listing, selectedId, onSelect, onRetry }: PersonalImportListProps) {
  const jobs = listing.data?.jobs ?? [];
  const formats = listing.data?.formats ?? [];
  return (
    <PanelSection icon={ListChecksIcon} title="Le tue importazioni" color="var(--swatch-slate)">
      {listing.isPending ? <p role="status" className="text-sm text-muted-foreground">Caricamento…</p> : null}
      {listing.error ? <p role="alert" className="text-sm text-destructive">{listing.error.message}</p> : null}
      {jobs.length === 0 && !listing.isPending && !listing.error ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <FileSpreadsheetIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Nessun file caricato</p>
          <p className="text-sm text-muted-foreground">Quando carichi un file lo trovi qui, con il suo stato.</p>
        </div>
      ) : null}
      {jobs.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {jobs.map((job) => {
            const state = islandState(job);
            const { message, action } = describeImportJob(job);
            const name = formats.find((f) => f.id === job.formatId)?.name ?? "File";
            const retry = action === "Riprova";
            const body = (
              <>
                <StatusIcon state={state} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-baseline gap-2"><span className="truncate text-sm font-medium text-foreground">{name}</span><span className="shrink-0 text-xs text-muted-foreground">{dayLabel(job.createdAt)}</span></span>
                  <span className={cn("truncate text-sm", state === "failed" ? "text-neg" : "text-muted-foreground")}>{state === "running" ? <TextShimmer>{message}</TextShimmer> : message}</span>
                </span>
                {action ? <span className="hidden shrink-0 text-sm font-medium text-primary sm:inline">{action}</span> : null}
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground sm:hidden" aria-hidden="true" />
              </>
            );
            const rowClass = cn("flex min-h-14 w-full items-center gap-3 py-3 text-left hover:bg-muted/40", selectedId === job.id && "bg-muted/40");
            return (
              <li key={job.id}>
                <button type="button" onClick={() => (retry && onRetry ? onRetry() : onSelect(job.id))} aria-current={selectedId === job.id ? "true" : undefined} className={cn(rowClass, "cursor-pointer")}>{body}</button>
                {state === "running" ? <ProgressBar state={{ kind: "indeterminate" }} label={`Importazione ${name} in corso`} className="mb-3 ml-11 w-auto" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </PanelSection>
  );
}
