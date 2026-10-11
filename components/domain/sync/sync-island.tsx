"use client";

/**
 * Isola di un job di sync: una pillola scura con anello di avanzamento e titolo che luccica mentre lavora; toccandola
 * si allarga nel dettaglio dei conti. A job concluso si apre da sola con l'esito e si può chiudere. Idea di Dynamic
 * Island di Cult UI (MIT), costruita con `motion` (layout animato) e i componenti di `components/motion`.
 */

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, ChevronDown, X } from "lucide-react";
import { AnimatedList, TextMorph, TextShimmer } from "@/components/motion";
import { SPRING_BOUNCY } from "@/lib/motion/springs";
import { overallProgress } from "@/lib/sync-jobs/view";
import type { SyncJobView } from "@/lib/sync-jobs/types";
import { cn } from "@/lib/utils";
import { describeJobTitle } from "./describe-account-progress";
import { SyncAccountProgressRow } from "./sync-account-progress-row";
import { SyncProgressRing } from "./sync-progress-ring";

const DISMISS_LABEL = "Chiudi riepilogo";
const TOGGLE_LABEL = "Mostra o nascondi i dettagli";
const CATEGORIZE_LABEL = "Categorizza";
/** Raggio della pillola chiusa e della scheda aperta, in px (animati da `motion` insieme alla forma). */
const PILL_RADIUS = 22;
const CARD_RADIUS = 18;

export interface SyncIslandProps {
  job: SyncJobView;
  onDismiss: (jobId: string) => void;
  categorizeHref: string;
}

export function SyncIsland({ job, onDismiss, categorizeHref }: SyncIslandProps) {
  const isRunning = job.status === "running";
  const [expanded, setExpanded] = React.useState(!isRunning);
  const detailsId = React.useId();
  const progress = overallProgress(job);
  const uncategorized = job.accounts.reduce((sum, account) => sum + account.uncategorized, 0);
  const title = describeJobTitle(job);
  const failed = job.status === "failed" || job.interrupted;

  // A job concluso l'isola si apre da sola per mostrare l'esito.
  const [wasRunning, setWasRunning] = React.useState(isRunning);
  if (wasRunning && !isRunning) {
    setWasRunning(false);
    setExpanded(true);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 8, transition: { duration: 0.18 } }}
      transition={SPRING_BOUNCY}
      style={{ borderRadius: expanded ? CARD_RADIUS : PILL_RADIUS }}
      className={cn(
        "island-ink overflow-hidden bg-island shadow-xl shadow-black/20",
        expanded ? "w-full sm:w-96" : "w-auto max-w-full"
      )}
    >
      <motion.div layout="position" className="flex items-center gap-2 py-2 pr-2 pl-3">
        <span className="flex size-6 shrink-0 items-center justify-center">
          {isRunning ? (
            <SyncProgressRing progress={progress} label={title} />
          ) : failed ? (
            <AlertCircle className="size-5 text-neg" aria-hidden="true" />
          ) : (
            <span className="flex size-5 items-center justify-center rounded-full bg-pos">
              <Check className="size-3.5 text-island" strokeWidth={3} aria-hidden="true" />
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          title={TOGGLE_LABEL}
          className="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-island-foreground/60"
        >
          <span className="min-w-0 truncate" aria-live="polite">
            {isRunning ? <TextShimmer>{title}</TextShimmer> : <TextMorph>{title}</TextMorph>}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn("ml-auto shrink-0 text-muted-foreground motion-safe:transition-transform", !expanded && "-rotate-90")}
          />
        </button>
        {!isRunning && (
          <button
            type="button"
            onClick={() => onDismiss(job.id)}
            aria-label={DISMISS_LABEL}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-island-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-island-foreground/60"
          >
            <X size={15} />
          </button>
        )}
      </motion.div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={detailsId}
            key="details"
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: { delay: 0.08, duration: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="px-3 pb-3"
          >
            <AnimatedList
              className="max-h-64 gap-3 overflow-y-auto pt-1"
              items={job.accounts.map((account) => ({
                key: account.accountId,
                content: <SyncAccountProgressRow account={account} interrupted={job.interrupted} />,
              }))}
            />
            {!isRunning && uncategorized > 0 && (
              <Link
                href={categorizeHref}
                className="mt-3 inline-flex rounded-full bg-island-foreground px-3 py-1 text-sm font-medium text-island hover:bg-island-foreground/90"
              >
                {CATEGORIZE_LABEL}
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
