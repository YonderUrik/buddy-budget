"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SyncJobView } from "@/lib/sync-jobs/types";
import { overallProgress } from "@/lib/sync-jobs/view";
import { ProgressBar } from "@/components/domain/shared";
import { describeJobTitle } from "./describe-account-progress";
import { SyncAccountProgressRow } from "./sync-account-progress-row";

const PANEL_LABEL = "Avanzamento sincronizzazione";
const DISMISS_LABEL = "Chiudi riepilogo";
const TOGGLE_LABEL = "Mostra o nascondi i dettagli";
const CATEGORIZE_LABEL = "Categorizza";

export interface SyncProgressPanelProps {
  jobs: SyncJobView[];
  onDismiss: (jobId: string) => void;
  /** Destinazione del link mostrato quando restano movimenti da categorizzare. */
  categorizeHref?: string;
}

/** Pannello flottante con l'avanzamento dei job di sync; un riquadro per job, chiudibile solo a job concluso. */
export function SyncProgressPanel({ jobs, onDismiss, categorizeHref = "/categorizza" }: SyncProgressPanelProps) {
  if (jobs.length === 0) return null;
  return (
    <section
      aria-label={PANEL_LABEL}
      className="fixed inset-x-4 bottom-[calc(1rem+var(--bottom-nav-offset,0px)+env(safe-area-inset-bottom))] z-50 md:bottom-4 flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96"
    >
      {jobs.map((job) => (
        <SyncJobCard key={job.id} job={job} onDismiss={onDismiss} categorizeHref={categorizeHref} />
      ))}
    </section>
  );
}

function SyncJobCard({
  job,
  onDismiss,
  categorizeHref,
}: {
  job: SyncJobView;
  onDismiss: (jobId: string) => void;
  categorizeHref: string;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const detailsId = React.useId();
  const isRunning = job.status === "running";
  const progress = overallProgress(job);
  const uncategorized = job.accounts.reduce((sum, account) => sum + account.uncategorized, 0);
  const title = describeJobTitle(job);

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          title={TOGGLE_LABEL}
          className="flex flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronDown
            size={16}
            className={cn("shrink-0 text-muted-foreground motion-safe:transition-transform", !expanded && "-rotate-90")}
          />
          <span className="text-sm font-medium" aria-live="polite">
            {title}
          </span>
        </button>
        {!isRunning && (
          <button
            type="button"
            onClick={() => onDismiss(job.id)}
            aria-label={DISMISS_LABEL}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {isRunning && (
        <ProgressBar
          className="mt-2"
          label={title}
          state={
            progress.kind === "determinate"
              ? { kind: "determinate", value: progress.processed, max: progress.total }
              : { kind: "indeterminate" }
          }
        />
      )}

      {expanded && (
        <ul id={detailsId} className="mt-3 flex max-h-64 flex-col gap-3 overflow-y-auto">
          {job.accounts.map((account) => (
            <SyncAccountProgressRow key={account.accountId} account={account} interrupted={job.interrupted} />
          ))}
        </ul>
      )}

      {!isRunning && uncategorized > 0 && (
        <Link
          href={categorizeHref}
          className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {CATEGORIZE_LABEL}
        </Link>
      )}
    </div>
  );
}
