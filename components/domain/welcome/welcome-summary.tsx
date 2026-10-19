"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Dall'ultima visita» on Panoramica: what happened while the user was away and what waits for them now, in one filled
 * block with a big count per line. Lines that wait have a pill action. Presentational: lines and callbacks via props.
 */

import Link from "next/link";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { SECTION_TITLE } from "@/components/domain/shared";
import { buttonVariants } from "@/components/ui/button";
import type { WelcomeItemKind } from "@/lib/welcome";
import { cn } from "@/lib/utils";
import type { WelcomeLine } from "./welcome-lines";

export interface WelcomeSummaryProps {
  /** «da ieri alle 18:40»: when the previous visit ended. */
  sinceLabel: string;
  happened: readonly WelcomeLine[];
  waiting: readonly WelcomeLine[];
  onItemClick?: (kind: WelcomeItemKind) => void;
  onDismiss?: () => void;
  dismissing?: boolean;
  className?: string;
}

/** Group heading inside the block. */
function GroupTitle({ children }: { children: string }) {
  return <h3 className="text-sm font-medium text-text-2">{children}</h3>;
}

const FIGURE_CLASS = "w-10 shrink-0 text-right font-display text-[2.25rem] font-light leading-none tabular-nums text-foreground sm:w-12 sm:text-[2.5rem]";
const LINK_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function LineText({ line }: { line: WelcomeLine }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-base font-medium text-foreground">
        <span className="sr-only">{line.figure} </span>
        {line.title}
      </span>
      <span className="block text-sm text-text-2">{line.detail}</span>
    </span>
  );
}

/** A line that waits: on the phone the pill goes under the text, so the text keeps the width. */
function WaitingRow({ line, onClick }: { line: WelcomeLine; onClick?: (kind: WelcomeItemKind) => void }) {
  return (
    <li className="flex items-start gap-3 py-2 sm:items-center sm:gap-4">
      <span className={FIGURE_CLASS} aria-hidden="true">
        {line.figure}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
        <LineText line={line} />
        <Link
          href={line.href}
          onClick={() => onClick?.(line.kind)}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 shrink-0 rounded-full px-5 text-sm")}
        >
          {line.action}
        </Link>
      </span>
    </li>
  );
}

/** A line that happened: the whole row opens its screen. */
function HappenedRow({ line, onClick }: { line: WelcomeLine; onClick?: (kind: WelcomeItemKind) => void }) {
  return (
    <li>
      <Link
        href={line.href}
        onClick={() => onClick?.(line.kind)}
        className={cn("-mx-3 flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 hover:bg-muted sm:gap-4", LINK_FOCUS)}
      >
        <span className={FIGURE_CLASS} aria-hidden="true">
          {line.figure}
        </span>
        <LineText line={line} />
        <ArrowRightIcon className="size-4 shrink-0 text-text-2" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function WelcomeSummary({ sinceLabel, happened, waiting, onItemClick, onDismiss, dismissing, className }: WelcomeSummaryProps) {
  const { t: tr } = useLocalization();
  if (happened.length === 0 && waiting.length === 0) return null;
  const both = happened.length > 0 && waiting.length > 0;
  return (
    <section aria-labelledby="welcome-summary" className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="welcome-summary" className={SECTION_TITLE}>
            {tr("Dall'ultima visita")}
          </h2>
          <p className="mt-1 text-sm text-text-2">{sinceLabel}</p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            disabled={dismissing}
            aria-label={tr("Chiudi fino alla prossima visita")}
            className={cn("-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-text-2 hover:bg-muted hover:text-foreground disabled:opacity-50", LINK_FOCUS)}
          >
            <XIcon className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className={cn("grid gap-6 rounded-3xl bg-card p-4 sm:p-7", both && "lg:grid-cols-2 lg:gap-10")}>
        {happened.length > 0 ? (
          <div className="flex flex-col gap-2">
            <GroupTitle>{tr("Mentre eri via")}</GroupTitle>
            <ul className="flex flex-col">
              {happened.map((line) => (
                <HappenedRow key={line.kind} line={line} onClick={onItemClick} />
              ))}
            </ul>
          </div>
        ) : null}
        {waiting.length > 0 ? (
          <div className="flex flex-col gap-2">
            <GroupTitle>{tr("Ti aspetta")}</GroupTitle>
            <ul className="flex flex-col">
              {waiting.map((line) => (
                <WaitingRow key={line.kind} line={line} onClick={onItemClick} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
