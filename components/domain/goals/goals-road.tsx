"use client";

/** «La strada»: le date di arrivo degli obiettivi aperti in fila, fino all'anno del traguardo. */

import { FlagIcon } from "lucide-react";
import type { GoalsView } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import { FIRE_GOAL_INFO, GOAL_KIND_INFO } from "./goal-kinds";
import type { GoalFormatters } from "./goal-format";
import { GoalIcon } from "./goal-icon";
import { GoalSectionHeading } from "./goal-section-heading";

export interface GoalsRoadProps {
  view: GoalsView;
  fmt: GoalFormatters;
}

interface Stop {
  key: string;
  when: string;
  sort: string;
  label: string;
  icon: (typeof GOAL_KIND_INFO)[keyof typeof GOAL_KIND_INFO]["icon"];
  color: string;
}

export function GoalsRoad({ view, fmt }: GoalsRoadProps) {
  const { t: tr } = useLocalization();
  const stops: Stop[] = view.goals
    .filter((g) => g.etaMonth !== null && g.status !== "raggiunto")
    .map((g) => ({ key: g.id, when: fmt.month(g.etaMonth!), sort: g.etaMonth!, label: g.name, icon: GOAL_KIND_INFO[g.kind].icon, color: GOAL_KIND_INFO[g.kind].color }));
  if (view.fire?.withGoalsYear) {
    stops.push({ key: "fire", when: String(view.fire.withGoalsYear), sort: `${view.fire.withGoalsYear}-12`, label: tr("Smetti di lavorare"), icon: FIRE_GOAL_INFO.icon, color: FIRE_GOAL_INFO.color });
  }
  if (stops.length < 2) return null;
  stops.sort((a, b) => a.sort.localeCompare(b.sort));
  return (
    <section aria-labelledby="goals-road" className="flex flex-col gap-4">
      <GoalSectionHeading id="goals-road" icon={FlagIcon} title={tr("La strada")} color="var(--swatch-blue)" />
      <ol className="relative flex gap-4 overflow-x-auto pb-2">
        <span className="absolute top-4 right-0 left-0 h-px bg-border" aria-hidden="true" />
        {stops.map((s) => (
          <li key={s.key} className="relative flex min-w-24 flex-1 flex-col items-center gap-1 text-center">
            <span className="rounded-full bg-background"><GoalIcon icon={s.icon} color={s.color} size="sm" /></span>
            <span className="text-sm font-medium text-foreground">{s.when}</span>
            <span className="line-clamp-2 text-xs text-text-3">{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-text-3">{tr("Date al ritmo di oggi, senza contare la crescita degli investimenti assegnati.")}</p>
    </section>
  );
}
