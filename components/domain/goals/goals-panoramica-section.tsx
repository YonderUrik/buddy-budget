"use client";

/**
 * Sezione «I tuoi obiettivi» della Panoramica: i più vicini alla meta, con il link alla vista completa. Senza obiettivi
 * fa conoscere la novità con un invito che si può chiudere (la scelta resta su questo dispositivo).
 */

import Link from "next/link";
import { TargetIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { OVERVIEW_GOALS } from "@/lib/goals/constants";
import { usePersistedFlag } from "@/lib/hooks/use-persisted-flag";
import type { GoalView, GoalsView } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import type { GoalFormatters } from "./goal-format";
import { GoalRow } from "./goal-row";
import { GoalSectionHeading } from "./goal-section-heading";

export interface GoalsPanoramicaSectionProps {
  view: GoalsView;
  fmt: GoalFormatters;
  href?: string;
  /** Indirizzo per creare il primo obiettivo (apre il form). */
  newHref?: string;
  onLinkClick?: () => void;
  /** False hides the «new feature» invite shown without goals (e.g. while the first steps are still on screen). */
  showInvite?: boolean;
  className?: string;
}

/** Chiave (per dispositivo) dell'invito chiuso. */
export const GOALS_INVITE_DISMISSED_KEY = "bb-goals-invite-dismissed";

/** Obiettivi aperti più vicini alla meta: prima chi arriva prima, poi chi è più avanti. */
export function closestGoals(goals: GoalView[], limit = OVERVIEW_GOALS): GoalView[] {
  return goals
    .filter((g) => g.status !== "raggiunto")
    .sort((a, b) => (a.monthsToGo ?? Infinity) - (b.monthsToGo ?? Infinity) || b.progress - a.progress)
    .slice(0, limit);
}

export function GoalsPanoramicaSection({ view, fmt, href = "/analitiche/obiettivi", newHref = "/analitiche/obiettivi?nuovo=1", onLinkClick, showInvite = true, className }: GoalsPanoramicaSectionProps) {
  const { t: tr } = useLocalization();
  const [dismissed, setDismissed] = usePersistedFlag(GOALS_INVITE_DISMISSED_KEY, false);
  const dismiss = () => setDismissed(true);
  const shown = closestGoals(view.goals);

  if (view.goals.length === 0) {
    if (dismissed || !showInvite) return null;
    return (
      <section aria-labelledby="overview-goals" data-page-block="" className={cn("flex flex-col gap-3", className)}>
        <div className="flex items-start justify-between gap-3">
          <GoalSectionHeading id="overview-goals" icon={TargetIcon} title={tr("Novità: obiettivi di risparmio")} color="var(--swatch-amber)" />
          <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" onClick={dismiss} aria-label={tr("Non ora")}>
            <XIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="text-sm text-text-2">{tr("Dai un nome ai tuoi risparmi: un viaggio, la casa, un fondo per gli imprevisti. Scegli da quali conti o investimenti arrivano i soldi e vedi quando ci arrivi e cosa cambia per il giorno in cui smetti di lavorare.")}</p>
        <Link href={newHref} onClick={onLinkClick} className={cn(buttonVariants({ variant: "outline" }), "h-11 w-fit sm:h-9")}>
          {tr("Crea il primo obiettivo")}
        </Link>
      </section>
    );
  }
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="overview-goals" data-page-block="" className={cn("flex flex-col gap-1", className)}>
      <GoalSectionHeading id="overview-goals" icon={TargetIcon} title={tr("I tuoi obiettivi")} color="var(--swatch-amber)" href={href} linkLabel={tr("Tutti")} onLinkClick={onLinkClick} />
      <ul>
        {shown.map((goal) => (
          <GoalRow key={goal.id} goal={goal} fmt={fmt} href={`${href}/${goal.id}`} compact />
        ))}
      </ul>
    </section>
  );
}
