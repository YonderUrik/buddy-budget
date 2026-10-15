"use client";

/** Quarto passo: quanto metterci ogni mese e, per un obiettivo nuovo, in che posizione della lista. */

import { CurrencyInput } from "@/components/domain/accounts";
import { StepHeading } from "@/components/domain/shared";
import type { GoalView } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import { isCovered, requiredMonthly, type GoalDraft } from "./goal-form-state";
import type { GoalFormatters } from "./goal-format";
import { GoalChoice } from "./goal-choice";
import { GoalNote } from "./goal-note";

export interface GoalPaceStepProps {
  draft: GoalDraft;
  currency: string;
  todayKey: string;
  /** Gli altri obiettivi aperti, in ordine: servono per scegliere la posizione. Assente = non si sceglie (modifica). */
  others?: GoalView[];
  capacity: { total: number; taken: number } | null;
  fmt: GoalFormatters;
  onChange: (patch: Partial<GoalDraft>) => void;
}

export function GoalPaceStep({ draft, currency, todayKey, others, capacity, fmt, onChange }: GoalPaceStepProps) {
  const { t: tr } = useLocalization();
  const required = requiredMonthly(draft, todayKey);
  const free = capacity ? Math.max(0, Math.floor(capacity.total - capacity.taken)) : null;
  return (
    <>
      <StepHeading title={tr("Quanto ogni mese?")} description={tr("È la quota del tuo risparmio che va a questo obiettivo. La puoi cambiare quando vuoi.")} />
      <div className="flex flex-wrap gap-2">
        {required !== null ? (
          <GoalChoice selected={draft.monthly === required} onClick={() => onChange({ monthly: required })}>
            {tr("Quanto serve: {0}", { 0: fmt.money(required) })}
          </GoalChoice>
        ) : null}
        {free !== null && free > 0 && free !== required ? (
          <GoalChoice selected={draft.monthly === free} onClick={() => onChange({ monthly: free })}>
            {tr("Quanto avanza: {0}", { 0: fmt.money(free) })}
          </GoalChoice>
        ) : null}
      </div>
      <label className="flex min-w-0 flex-col gap-1.5 text-sm text-text-2">
        {tr("Quota al mese")}
        <CurrencyInput data-autofocus value={draft.monthly} currency={currency} onChange={(monthly) => onChange({ monthly: monthly === null ? null : Math.max(0, monthly) })} className="h-11 w-full" aria-label={tr("Quota al mese")} />
      </label>
      {others && others.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-2">{tr("Chi riceve per primo il risparmio del mese?")}</p>
          <div role="radiogroup" aria-label={tr("Posizione nella lista")} className="flex flex-wrap gap-2">
            <GoalChoice role="radio" aria-checked={draft.priority === 0} selected={draft.priority === 0} onClick={() => onChange({ priority: 0 })}>
              {tr("Prima di tutti")}
            </GoalChoice>
            {others.map((g, i) => (
              <GoalChoice key={g.id} role="radio" aria-checked={draft.priority === i + 1} selected={draft.priority === i + 1} onClick={() => onChange({ priority: i + 1 })}>
                {i === others.length - 1 ? tr("In fondo, dopo {0}", { 0: g.name }) : tr("Dopo {0}", { 0: g.name })}
              </GoalChoice>
            ))}
          </div>
        </div>
      ) : null}
      {isCovered(draft) ? <GoalNote>{tr("Con i soldi che hai già assegnato l'obiettivo è coperto: la quota può restare a zero.")}</GoalNote> : null}
      {free !== null && draft.monthly !== null && draft.monthly > free + 0.5 ? (
        <GoalNote>{tr("Oggi ne avanzano {0} al mese: chi sta più in basso nella lista riceverà meno.", { 0: fmt.money(free) })}</GoalNote>
      ) : null}
    </>
  );
}
