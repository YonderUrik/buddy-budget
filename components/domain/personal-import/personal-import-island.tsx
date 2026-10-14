"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Isola globale delle importazioni personali: in ogni pagina mostra i file in elaborazione (anello che gira, nome della
 * banca), a lavoro finito l'esito con i conteggi e il link al dettaglio. Si chiude da sola solo a mano; la chiusura
 * si ricorda su questo dispositivo. Si impila sotto le isole dei sync (vedi `SyncProgressPanel`).
 */

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, X } from "lucide-react";
import { TextMorph, TextShimmer } from "@/components/motion";
import { SyncProgressRing } from "@/components/domain/sync/sync-progress-ring";
import { SPRING_BOUNCY } from "@/lib/motion/springs";
import { ISLAND_DISMISSED_STORAGE_KEY, islandJobs, islandState, runningImportIds } from "@/lib/personal-import/island";
import { usePersonalImportsQuery, type PersonalImportListing } from "@/lib/queries/personal-imports";
import { QUERY_KEYS_CHANGED_BY_CATEGORIZATION } from "@/lib/queries/categorization";
import { cn } from "@/lib/utils";

type Job = PersonalImportListing["jobs"][number];

/** Dati che un import concluso può aver cambiato: da ricaricare quando l'isola vede la fine del lavoro. */
const QUERY_KEYS_CHANGED_BY_IMPORT = [["accounts"], ["investments"], ["net-worth-snapshots"], ...QUERY_KEYS_CHANGED_BY_CATEGORIZATION] as const;
const DISMISS_LABEL = "Chiudi riepilogo importazione";
const MAX_DISMISSED_IDS = 50;

function readDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(ISLAND_DISMISSED_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>): void {
  try {
    window.localStorage.setItem(ISLAND_DISMISSED_STORAGE_KEY, JSON.stringify([...ids].slice(-MAX_DISMISSED_IDS)));
  } catch {
    // Archiviazione non disponibile: la chiusura vale solo finché la pagina resta aperta.
  }
}

export interface PersonalImportIslandCardProps {
  job: Job;
  /** Nome della banca o del broker del file. */
  source: string;
  onDismiss: (id: string) => void;
}

/** Una pillola per importazione: titolo e stato, esito e link a fine lavoro. */
export function PersonalImportIslandCard({ job, source, onDismiss }: PersonalImportIslandCardProps) {
  const { t: tr } = useLocalization();
  const state = islandState(job);
  const running = state === "running";
  const failed = state === "failed";
  const results = job.results;
  const title = running ? tr("{0}: importo il file", { 0: source }) : failed ? tr("{0}: non riuscito", { 0: source }) : tr("{0}: completato", { 0: source });
  const detail = running
    ? tr("Puoi continuare a usare l'app.")
    : failed
      ? tr("Vedi cosa fare.")
      : results
        ? tr("{0} movimenti · {1} operazioni", { 0: results.cash, 1: results.investments })
        : tr("Dati aggiunti.");
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 8, transition: { duration: 0.18 } }}
      transition={SPRING_BOUNCY}
      className="island-ink w-full overflow-hidden rounded-[18px] bg-island shadow-xl shadow-black/20 sm:w-96"
    >
      <div className="flex items-center gap-3 py-2.5 pr-2 pl-3">
        <span className="flex size-6 shrink-0 items-center justify-center">
          {running ? (
            <SyncProgressRing progress={{ kind: "indeterminate" }} label={tr(title)} />
          ) : failed ? (
            <AlertCircle className="size-5 text-neg" aria-hidden="true" />
          ) : (
            <span className="flex size-5 items-center justify-center rounded-full bg-pos"><Check className="size-3.5 text-island" strokeWidth={3} aria-hidden="true" /></span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col" aria-live="polite">
          <span className="truncate text-sm font-medium">{running ? <TextShimmer>{tr(title)}</TextShimmer> : <TextMorph>{tr(title)}</TextMorph>}</span>
          <span className="truncate text-xs text-muted-foreground">{detail}</span>
        </div>
        <Link href={`/importazioni?job=${job.id}`} className={cn("inline-flex min-h-8 shrink-0 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-island-foreground/60", running ? "text-muted-foreground hover:text-foreground" : "bg-island-foreground text-island hover:bg-island-foreground/90")}>{tr("Dettaglio")}</Link>
        {!running ? (
          <button type="button" onClick={() => onDismiss(job.id)} aria-label={DISMISS_LABEL} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-island-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-island-foreground/60">
            <X size={15} />
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

/** Contenitore: legge le importazioni, aggiorna i dati a fine lavoro e ricorda le chiusure. Montare una volta nel layout. */
export function PersonalImportIsland() {
  const { data } = usePersonalImportsQuery();
  const client = useQueryClient();
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : readDismissed()));
  const [now] = React.useState(() => Date.now());

  const previous = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const running = runningImportIds(data?.jobs);
    const finished = [...previous.current].some((id) => !running.has(id));
    if (finished) for (const key of QUERY_KEYS_CHANGED_BY_IMPORT) void client.invalidateQueries({ queryKey: [...key] });
    previous.current = running;
  }, [data, client]);

  const dismiss = React.useCallback((id: string) => {
    setDismissed((current) => {
      const next = new Set(current).add(id);
      writeDismissed(next);
      return next;
    });
  }, []);

  const jobs = islandJobs(data?.jobs, dismissed, now);
  return (
    <AnimatePresence initial={false}>
      {jobs.map((job) => (
        <PersonalImportIslandCard key={job.id} job={job} source={data?.formats.find((f) => f.id === job.formatId)?.name ?? "file"} onDismiss={dismiss} />
      ))}
    </AnimatePresence>
  );
}
