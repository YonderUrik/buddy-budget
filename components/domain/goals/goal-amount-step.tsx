"use client";

/** Secondo passo: quanto serve ed entro quando. Per il fondo di emergenza la cifra parte dai mesi di spese dovute. */

import { CurrencyInput } from "@/components/domain/accounts";
import { StepHeading } from "@/components/domain/shared";
import { Input } from "@/components/ui/input";
import { EMERGENCY_MONTH_CHOICES } from "@/lib/goals/constants";
import { addMonthsKey } from "@/lib/goals/plan";
import { useLocalization } from "@/lib/localization/provider";
import { emergencyTarget, requiredMonthly, type GoalDraft } from "./goal-form-state";
import type { GoalFormatters } from "./goal-format";
import { GoalChoice } from "./goal-choice";
import { GoalNote } from "./goal-note";

export interface GoalAmountStepProps {
  draft: GoalDraft;
  currency: string;
  todayKey: string;
  essentialMonthly: number | null;
  /** Risparmio del mese e quanto ne prendono già gli altri obiettivi; null se non si sa. */
  capacity: { total: number; taken: number } | null;
  fmt: GoalFormatters;
  onChange: (patch: Partial<GoalDraft>) => void;
}

export function GoalAmountStep({ draft, currency, todayKey, essentialMonthly, capacity, fmt, onChange }: GoalAmountStepProps) {
  const { t: tr } = useLocalization();
  const minMonth = addMonthsKey(todayKey, 1);
  const required = requiredMonthly(draft, todayKey);
  const emergency = draft.kind === "emergenza";
  return (
    <>
      <StepHeading
        title={emergency ? tr("Quanti mesi di spese vuoi coprire?") : tr("Quanto ti serve, ed entro quando?")}
        description={tr("La data è facoltativa: senza, ti diciamo solo quando ci arrivi al ritmo di oggi.")}
      />
      {emergency && essentialMonthly !== null ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {EMERGENCY_MONTH_CHOICES.map((months) => (
              <GoalChoice key={months} selected={draft.emergencyMonths === months} onClick={() => onChange({ emergencyMonths: months, target: emergencyTarget(essentialMonthly, months) })}>
                {tr("{0} mesi", { 0: months })}
              </GoalChoice>
            ))}
          </div>
          <p className="text-xs text-text-3">{tr("Le tue spese dovute (casa, bollette, spesa, rate) sono circa {0} al mese.", { 0: fmt.money(essentialMonthly) })}</p>
        </div>
      ) : null}
      <label className="flex min-w-0 flex-col gap-1.5 text-sm text-text-2">
        {tr("Quanto ti serve")}
        <CurrencyInput data-autofocus value={draft.target} currency={currency} onChange={(target) => onChange({ target, emergencyMonths: null })} className="h-11 w-full" aria-label={tr("Quanto ti serve")} />
      </label>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-2">{tr("Entro quando")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <GoalChoice selected={draft.targetMonth === null} onClick={() => onChange({ targetMonth: null })}>
            {tr("Nessuna data")}
          </GoalChoice>
          <Input
            type="month"
            min={minMonth}
            value={draft.targetMonth ?? ""}
            onChange={(e) => onChange({ targetMonth: e.target.value || null })}
            className="h-11 w-auto sm:h-9"
            aria-label={tr("Mese entro cui arrivarci")}
          />
        </div>
      </div>
      {required !== null && draft.targetMonth ? (
        <GoalNote>
          {tr("Per arrivare a {0} servono {1} al mese.", { 0: fmt.month(draft.targetMonth), 1: fmt.money(required) })}
          {capacity ? ` ${tr("Metti da parte {0} al mese, di cui {1} già presi dagli altri obiettivi.", { 0: fmt.money(capacity.total), 1: fmt.money(capacity.taken) })}` : ""}
        </GoalNote>
      ) : null}
    </>
  );
}
