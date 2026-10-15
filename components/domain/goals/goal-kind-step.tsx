"use client";

/** Primo passo: che tipo di obiettivo e come si chiama. */

import { StepHeading } from "@/components/domain/shared";
import { Input } from "@/components/ui/input";
import { GOAL_KINDS, type GoalKind } from "@/lib/goals/constants";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { GOAL_KIND_INFO } from "./goal-kinds";
import { GoalIcon } from "./goal-icon";
import type { GoalDraft } from "./goal-form-state";

export interface GoalKindStepProps {
  draft: GoalDraft;
  onKind: (kind: GoalKind) => void;
  onName: (name: string) => void;
}

export function GoalKindStep({ draft, onKind, onName }: GoalKindStepProps) {
  const { t: tr } = useLocalization();
  return (
    <>
      <StepHeading title={tr("Che cosa vuoi raggiungere?")} />
      <div role="radiogroup" aria-label={tr("Tipo di obiettivo")} className="grid gap-2 sm:grid-cols-2">
        {GOAL_KINDS.map((kind) => {
          const info = GOAL_KIND_INFO[kind];
          const selected = draft.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onKind(kind)}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
              )}
            >
              <GoalIcon icon={info.icon} color={info.color} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-foreground">{tr(info.label)}</span>
                <span className="text-xs text-text-3">{tr(info.hint)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {draft.kind ? (
        <label className="flex min-w-0 flex-col gap-1.5 text-sm text-text-2">
          {tr("Nome")}
          <Input value={draft.name} maxLength={80} placeholder={tr("es. Viaggio in Giappone")} onChange={(e) => onName(e.target.value)} />
        </label>
      ) : null}
    </>
  );
}
