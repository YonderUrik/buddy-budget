"use client";

/** Avanzamento di un'importazione personale (analisi → salvataggio → fatto) e elenco dei file caricati. */

import Link from "next/link";
import { CheckCircle2, Clock3, ListChecksIcon } from "lucide-react";
import { DialogSteps, PanelSection } from "@/components/domain/investments";
import { personalImportLabels as labels, type PersonalImportListing } from "@/lib/queries/personal-imports";
import { cn } from "@/lib/utils";

type Job = PersonalImportListing["jobs"][number];

export const PERSONAL_IMPORT_ACTIVE = ["queued", "processing", "ready"] as const;
const STEPS = ["Analisi del file", "Controlli e salvataggio", "Fatto"] as const;

export function isActiveJob(job: Job | undefined): boolean {
  return !!job && (PERSONAL_IMPORT_ACTIVE as readonly string[]).includes(job.status);
}

const STATUS_COLOR: Record<string, string> = {
  imported: "var(--pos)",
  failed: "var(--destructive)",
  review_failed: "var(--destructive)",
  expired: "var(--swatch-amber)",
};

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
}

/** «Le tue importazioni»: una riga per file con stato a colori e testo; la riga scelta ha `aria-current`. */
export function PersonalImportList({ listing, selectedId, onSelect }: PersonalImportListProps) {
  const jobs = listing.data?.jobs ?? [];
  return (
    <PanelSection icon={ListChecksIcon} title="Le tue importazioni" color="var(--swatch-slate)" description={jobs.length === 0 && !listing.isPending ? "I file che carichi compariranno qui, con il loro stato." : "Apri una riga per seguire l'analisi o vederne il dettaglio."}>
      {listing.isPending ? <p role="status" className="text-sm text-muted-foreground">Caricamento…</p> : null}
      {listing.error ? <p role="alert" className="text-sm text-destructive">{listing.error.message}</p> : null}
      {jobs.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {jobs.map((job) => (
            <li key={job.id}>
              <button type="button" onClick={() => onSelect(job.id)} aria-current={selectedId === job.id ? "true" : undefined} className={cn("flex min-h-14 w-full cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-left hover:bg-muted/40", selectedId === job.id && "font-medium")}>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{listing.data?.formats.find((f) => f.id === job.formatId)?.name}</span>
                  <span className="block text-xs text-muted-foreground">Caricato il {new Date(job.createdAt).toLocaleString("it-IT")}{["ready", "review_failed"].includes(job.status) ? ` · disponibile fino al ${new Date(job.expiresAt).toLocaleDateString("it-IT")}` : ""}</span>
                  {job.error && job.status !== "imported" ? <span className="block text-xs text-destructive">{job.error}</span> : null}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[job.status] ?? "var(--swatch-indigo)" }} aria-hidden="true" />
                  {labels[job.status] ?? job.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </PanelSection>
  );
}
