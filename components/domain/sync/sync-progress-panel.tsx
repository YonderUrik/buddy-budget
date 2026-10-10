"use client";

import { AnimatePresence } from "motion/react";
import type { SyncJobView } from "@/lib/sync-jobs/types";
import { SyncIsland } from "./sync-island";

const PANEL_LABEL = "Avanzamento sincronizzazione";

export interface SyncProgressPanelProps {
  jobs: SyncJobView[];
  onDismiss: (jobId: string) => void;
  /** Destinazione del link mostrato quando restano movimenti da categorizzare. */
  categorizeHref?: string;
}

/**
 * Contenitore flottante dei job di sync: un'isola per job, in basso (al centro su mobile, a destra su desktop).
 * Le isole entrano ed escono con una molla; ognuna si chiude solo a job concluso.
 */
export function SyncProgressPanel({ jobs, onDismiss, categorizeHref = "/categorizza" }: SyncProgressPanelProps) {
  return (
    <section
      aria-label={PANEL_LABEL}
      className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+var(--bottom-nav-offset,0px)+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 md:bottom-4 sm:left-auto sm:right-4 sm:w-96 sm:items-end [&>*]:pointer-events-auto"
    >
      <AnimatePresence initial={false}>
        {jobs.map((job) => (
          <SyncIsland key={job.id} job={job} onDismiss={onDismiss} categorizeHref={categorizeHref} />
        ))}
      </AnimatePresence>
    </section>
  );
}
