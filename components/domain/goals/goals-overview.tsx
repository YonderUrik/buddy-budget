"use client";

/**
 * Vista Obiettivi: quanto risparmi contro quanto chiedono gli obiettivi, la lista per priorità (con il traguardo delle
 * Analitiche in fondo) e «La strada». Gli obiettivi raggiunti stanno in fondo, a parte.
 */

import * as React from "react";
import { ListOrderedIcon, TrophyIcon } from "lucide-react";
import { LogoCredit } from "@/components/domain/shared";
import type { GoalsView, GoalView } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import type { GoalAction } from "./goal-actions";
import { FireGoalRow } from "./fire-goal-row";
import type { GoalFormatters } from "./goal-format";
import { GoalRow } from "./goal-row";
import { GoalSectionHeading } from "./goal-section-heading";
import { GoalsCapacity } from "./goals-capacity";
import { GoalsRoad } from "./goals-road";

export interface GoalsOverviewProps {
  view: GoalsView;
  fmt: GoalFormatters;
  /** Indirizzo del dettaglio di un obiettivo. */
  hrefFor: (id: string) => string;
  /** Nuovo ordine degli obiettivi aperti (id dal primo all'ultimo). */
  onReorder: (ids: string[]) => void;
  reordering?: boolean;
  /** Azione scelta dal menu «⋯» di una riga (assente = niente menu). */
  onAction?: (goal: GoalView, action: GoalAction) => void;
}

export function GoalsOverview({ view, fmt, hrefFor, onReorder, reordering = false, onAction }: GoalsOverviewProps) {
  const { t: tr } = useLocalization();
  const open = view.goals.filter((g) => g.status !== "raggiunto" || !g.achievedAt);
  const done = view.goals.filter((g) => g.status === "raggiunto" && g.achievedAt);
  const allIds = view.goals.map((g) => g.id);
  const [logosShown, setLogosShown] = React.useState(false);
  const showLogoCredit = React.useCallback(() => setLogosShown(true), []);

  /** Scambia un obiettivo aperto con il vicino (tra gli aperti); i raggiunti restano dove sono nell'ordine completo. */
  const move = (index: number, delta: -1 | 1) => {
    const a = open[index].id;
    const b = open[index + delta].id;
    const ids = [...allIds];
    const ia = ids.indexOf(a);
    const ib = ids.indexOf(b);
    [ids[ia], ids[ib]] = [ids[ib], ids[ia]];
    onReorder(ids);
  };

  return (
    <div className="flex flex-col gap-8">
      <GoalsCapacity view={view} fmt={fmt} />
      <section aria-labelledby="goals-list" className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <GoalSectionHeading id="goals-list" icon={ListOrderedIcon} title={tr("In ordine di priorità")} color="var(--swatch-amber)" />
          {open.length > 1 ? <span className="hidden text-xs text-text-3 sm:block">{tr("Usa le frecce per cambiare l'ordine")}</span> : null}
        </div>
        <ul>
          {open.map((goal, i) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              fmt={fmt}
              href={hrefFor(goal.id)}
              onMoveUp={i > 0 && !reordering ? () => move(i, -1) : undefined}
              onMoveDown={i < open.length - 1 && !reordering ? () => move(i, 1) : undefined}
              onAction={onAction ? (a) => onAction(goal, a) : undefined}
              onRemoteLogo={showLogoCredit}
            />
          ))}
          {view.fire ? <FireGoalRow fire={view.fire} fmt={fmt} /> : null}
        </ul>
        <LogoCredit visible={logosShown} />
      </section>
      <GoalsRoad view={view} fmt={fmt} />
      {done.length > 0 ? (
        <section aria-labelledby="goals-done" className="flex flex-col gap-1">
          <GoalSectionHeading id="goals-done" icon={TrophyIcon} title={tr("Raggiunti")} color="var(--pos)" />
          <ul>
            {done.map((goal) => (
              <GoalRow key={goal.id} goal={goal} fmt={fmt} href={hrefFor(goal.id)} compact onAction={onAction ? (a) => onAction(goal, a) : undefined} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
