"use client";

/**
 * Riga di un obiettivo nella lista per priorità: icona, nome (link al dettaglio), quanto c'è di quanto serve, barra,
 * frase sullo stato con l'effetto sul traguardo e le fonti come etichette. Le frecce spostano la priorità, il menu «⋯»
 * apre le azioni (modifica, aggiorna i soldi da parte, raggiunto, elimina).
 */

import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, CheckCircle2Icon, EllipsisIcon, PencilIcon, PiggyBankIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { GoalView } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import type { GoalAction } from "./goal-actions";
import { GOAL_KIND_INFO } from "./goal-kinds";
import { fireShiftText, statusLabel, statusSentence, type GoalFormatters } from "./goal-format";
import { GoalIcon } from "./goal-icon";
import { GoalProgress } from "./goal-progress";
import { GoalSourceIcon } from "./goal-source-icon";

export interface GoalRowProps {
  goal: GoalView;
  fmt: GoalFormatters;
  href: string;
  /** Assenti = la freccia non c'è (primo o ultimo della lista, o riordino in corso). */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Righe compatte (Panoramica): senza fonti né frecce. */
  compact?: boolean;
  /** Presente = menu «⋯» con le azioni sull'obiettivo. */
  onAction?: (action: GoalAction) => void;
  /** Chiamata quando compare il logo di un titolo tra le fonti (serve a citare Logo.dev). */
  onRemoteLogo?: () => void;
}

const STATUS_CLASS: Record<string, string> = { in_linea: "text-pos", raggiunto: "text-pos", in_ritardo: "text-[var(--swatch-amber-dark)] dark:text-[var(--swatch-amber)]" };

export function GoalRow({ goal, fmt, href, onMoveUp, onMoveDown, compact = false, onAction, onRemoteLogo }: GoalRowProps) {
  const { t: tr } = useLocalization();
  const info = GOAL_KIND_INFO[goal.kind];
  const label = statusLabel(goal, tr);
  const shift = fireShiftText(goal, tr);
  return (
    <li className={cn("flex gap-3 border-b last:border-b-0", compact ? "py-3" : "py-4")}>
      <GoalIcon icon={info.icon} color={info.color} size={compact ? "sm" : "md"} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <Link href={href} className="min-w-0 max-w-full truncate rounded font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {goal.name}
          </Link>
          <p className="shrink-0 tabular-nums">
            <span className={cn("font-heading font-medium text-foreground", compact ? "text-base" : "text-lg")}>{fmt.money(goal.current)}</span>{" "}
            <span className="text-sm text-text-3">{tr("di {0}", { 0: fmt.money(goal.target) })}</span>
          </p>
        </div>
        <GoalProgress progress={goal.progress} status={goal.status} label={tr("Avanzamento di {0}", { 0: goal.name })} />
        <p className="text-sm text-text-2">
          {label ? <span className={cn("font-medium", STATUS_CLASS[goal.status])}>{label} · </span> : null}
          {statusSentence(goal, fmt, tr)}
          {shift && !compact ? <span className="mt-0.5 block text-text-3 first-letter:uppercase">{shift}.</span> : null}
        </p>
        {!compact && goal.sources.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={tr("Da dove arrivano i soldi")}>
            {goal.sources.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5 rounded-full bg-muted py-1 pr-2.5 pl-1 text-xs text-text-2">
                <GoalSourceIcon source={s} size="xs" onRemoteLogo={onRemoteLogo} />
                {s.name} {fmt.money(s.counted)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {onAction ? <GoalRowMenu name={goal.name} achieved={Boolean(goal.achievedAt)} onAction={onAction} /> : null}
      {!compact && (onMoveUp || onMoveDown) ? (
        <div className="flex shrink-0 flex-col gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-9" onClick={onMoveUp} disabled={!onMoveUp} aria-label={tr("Sposta {0} più in alto", { 0: goal.name })}>
            <ArrowUpIcon className="size-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-9" onClick={onMoveDown} disabled={!onMoveDown} aria-label={tr("Sposta {0} più in basso", { 0: goal.name })}>
            <ArrowDownIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** Menu «⋯» di una riga: le stesse azioni del dettaglio. */
function GoalRowMenu({ name, achieved, onAction }: { name: string; achieved: boolean; onAction: (action: GoalAction) => void }) {
  const { t: tr } = useLocalization();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-9 shrink-0 cursor-pointer")} aria-label={tr("Azioni per {0}", { 0: name })}>
        <EllipsisIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem className="min-h-11 gap-2" onClick={() => onAction("edit")}>
          <PencilIcon className="size-4" aria-hidden="true" /> {tr("Modifica")}
        </DropdownMenuItem>
        {achieved ? null : (
          <DropdownMenuItem className="min-h-11 gap-2" onClick={() => onAction("addMoney")}>
            <PiggyBankIcon className="size-4" aria-hidden="true" /> {tr("Aggiorna i soldi da parte")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="min-h-11 gap-2" onClick={() => onAction("toggleAchieved")}>
          {achieved ? <RotateCcwIcon className="size-4" aria-hidden="true" /> : <CheckCircle2Icon className="size-4" aria-hidden="true" />}{" "}
          {achieved ? tr("Riapri") : tr("Segna come raggiunto")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="min-h-11 gap-2" onClick={() => onAction("delete")}>
          <Trash2Icon className="size-4" aria-hidden="true" /> {tr("Elimina")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
