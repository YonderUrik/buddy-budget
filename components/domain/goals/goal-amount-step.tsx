"use client";

/**
 * Secondo passo: quanto serve ed entro quando. Per il fondo di emergenza la cifra è mesi × spese al mese: le spese
 * arrivano già calcolate dai movimenti (si possono cambiare) e senza movimenti si scrivono a mano.
 */

import { CurrencyInput } from "@/components/domain/accounts";
import { StepHeading } from "@/components/domain/shared";
import { EMERGENCY_MONTH_CHOICES } from "@/lib/goals/constants";
import { addMonthsKey } from "@/lib/goals/plan";
import { useLocalization } from "@/lib/localization/provider";
import { emergencyTarget, requiredMonthly, type GoalDraft } from "./goal-form-state";
import type { GoalFormatters } from "./goal-format";
import { GoalChoice } from "./goal-choice";
import { GoalMonthPicker } from "./goal-month-picker";
import { GoalNote } from "./goal-note";

export interface GoalAmountStepProps {
  draft: GoalDraft;
  currency: string;
  todayKey: string;
  essentialMonthly: number | null;
  /** Da dove vengono le spese al mese: solo le dovute o tutte le uscite. */
  essentialBasis: "dovute" | "tutte" | null;
  /** Risparmio del mese e quanto ne prendono già gli altri obiettivi; null se non si sa. */
  capacity: { total: number; taken: number } | null;
  fmt: GoalFormatters;
  onChange: (patch: Partial<GoalDraft>) => void;
}

export function GoalAmountStep({ draft, currency, todayKey, essentialMonthly, essentialBasis, capacity, fmt, onChange }: GoalAmountStepProps) {
  const { t: tr } = useLocalization();
  const minMonth = addMonthsKey(todayKey, 1);
  const required = requiredMonthly(draft, todayKey);
  const emergency = draft.kind === "emergenza";
  const spend = draft.monthlySpend ?? essentialMonthly;
  const spendNote =
    draft.monthlySpend !== null || essentialBasis === null
      ? tr("Scrivi quanto spendi in un mese: la cifra si aggiorna da sola.")
      : essentialBasis === "dovute"
        ? tr("Media delle tue spese dovute e saltuarie degli ultimi mesi (casa, bollette, spesa, rate). Puoi cambiarla.")
        : tr("Media di tutte le tue uscite degli ultimi mesi: molte non hanno ancora una categoria, quindi è una stima larga. Puoi cambiarla.");
  return (
    <>
      <StepHeading
        title={emergency ? tr("Quanti mesi di spese vuoi coprire?") : tr("Quanto ti serve, ed entro quando?")}
        description={tr("La data è facoltativa: senza, ti diciamo solo quando ci arrivi al ritmo di oggi.")}
      />
      {emergency ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {EMERGENCY_MONTH_CHOICES.map((months) => (
              <GoalChoice
                key={months}
                selected={draft.emergencyMonths === months}
                onClick={() => onChange(spend === null ? { emergencyMonths: months } : { emergencyMonths: months, target: emergencyTarget(spend, months) })}
              >
                {tr("{0} mesi", { 0: months })}
              </GoalChoice>
            ))}
          </div>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm text-text-2">
            {tr("Spese al mese")}
            <CurrencyInput
              value={spend}
              currency={currency}
              onChange={(value) =>
                onChange(
                  value !== null && draft.emergencyMonths !== null
                    ? { monthlySpend: value, target: emergencyTarget(value, draft.emergencyMonths) }
                    : { monthlySpend: value },
                )
              }
              className="h-11 w-full"
              aria-label={tr("Spese al mese")}
            />
            <span className="text-xs text-text-3">{spendNote}</span>
          </label>
        </div>
      ) : null}
      <label className="flex min-w-0 flex-col gap-1.5 text-sm text-text-2">
        {tr("Quanto ti serve")}
        <CurrencyInput data-autofocus={emergency ? undefined : true} value={draft.target} currency={currency} onChange={(target) => onChange({ target, emergencyMonths: null })} className="h-11 w-full" aria-label={tr("Quanto ti serve")} />
      </label>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-2">{tr("Entro quando")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <GoalChoice selected={draft.targetMonth === null} onClick={() => onChange({ targetMonth: null })}>
            {tr("Nessuna data")}
          </GoalChoice>
          <GoalMonthPicker value={draft.targetMonth} min={minMonth} onChange={(targetMonth) => onChange({ targetMonth })} aria-label={tr("Mese entro cui arrivarci")} />
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
