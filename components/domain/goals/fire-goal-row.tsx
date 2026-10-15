"use client";

/** Il traguardo delle Analitiche come ultima riga della lista: prende quello che avanza dagli altri obiettivi. */

import Link from "next/link";
import type { GoalsView } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import { FIRE_GOAL_INFO } from "./goal-kinds";
import type { GoalFormatters } from "./goal-format";
import { GoalIcon } from "./goal-icon";

export interface FireGoalRowProps {
  fire: NonNullable<GoalsView["fire"]>;
  fmt: GoalFormatters;
  href?: string;
}

export function FireGoalRow({ fire, fmt, href = "/analitiche" }: FireGoalRowProps) {
  const { t: tr } = useLocalization();
  const progress = Math.min(1, Math.max(0, fire.progress));
  const moved = fire.baseYear !== null && fire.withGoalsYear !== null && fire.withGoalsYear !== fire.baseYear;
  const sentence =
    fire.withGoalsYear === null
      ? tr("Il traguardo delle Analitiche: al ritmo di oggi non ci arrivi entro 50 anni.")
      : moved
        ? tr("Il traguardo delle Analitiche: ci arrivi nel {0} con i tuoi obiettivi, nel {1} senza.", { 0: fire.withGoalsYear, 1: fire.baseYear! })
        : tr("Il traguardo delle Analitiche: ci arrivi nel {0}.", { 0: fire.withGoalsYear });
  return (
    <li className="flex gap-3 py-4">
      <GoalIcon icon={FIRE_GOAL_INFO.icon} color={FIRE_GOAL_INFO.color} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Link href={href} className="min-w-0 truncate rounded font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {tr("Smettere di lavorare")}
          </Link>
          <p className="shrink-0 tabular-nums">
            <span className="font-heading text-lg font-medium text-foreground">{fmt.money(fire.wealth)}</span>{" "}
            <span className="text-sm text-text-3">{tr("di {0}", { 0: fmt.money(fire.target) })}</span>
          </p>
        </div>
        <div role="progressbar" aria-label={tr("Avanzamento verso il traguardo")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: FIRE_GOAL_INFO.color }} />
        </div>
        <p className="text-sm text-text-2">{sentence}</p>
      </div>
    </li>
  );
}
