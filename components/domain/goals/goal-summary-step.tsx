"use client";

/** Ultimo passo: il riepilogo di quello che si sta per salvare. */

import { StepHeading } from "@/components/domain/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocalization } from "@/lib/localization/provider";
import { GOAL_KIND_INFO } from "./goal-kinds";
import { assignedTotal, type GoalDraft } from "./goal-form-state";
import type { GoalFormatters } from "./goal-format";
import { GoalIcon } from "./goal-icon";

export interface GoalSummaryStepProps {
  draft: GoalDraft;
  fmt: GoalFormatters;
  sourceNames: Record<string, string>;
  /** Interruttore «Ricordamelo per email», solo se i promemoria sono spenti. */
  reminders?: { checked: boolean; onChange: (checked: boolean) => void };
}

export function GoalSummaryStep({ draft, fmt, sourceNames, reminders }: GoalSummaryStepProps) {
  const { t: tr } = useLocalization();
  const info = draft.kind ? GOAL_KIND_INFO[draft.kind] : null;
  const sources = Object.entries(draft.sources);
  const rows = [
    { label: tr("Quanto"), value: fmt.money(draft.target ?? 0) },
    { label: tr("Entro"), value: draft.targetMonth ? fmt.month(draft.targetMonth) : tr("Nessuna data") },
    { label: tr("Già da parte"), value: sources.length === 0 ? tr("Niente, parti da zero") : fmt.money(assignedTotal(draft)) },
    { label: tr("Ogni mese"), value: fmt.money(draft.monthly ?? 0) },
  ];
  return (
    <>
      <StepHeading title={tr("Tutto giusto?")} />
      <div className="flex items-center gap-3">
        {info ? <GoalIcon icon={info.icon} color={info.color} /> : null}
        <p className="font-heading text-lg font-medium text-foreground">{draft.name}</p>
      </div>
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3 border-b py-2.5 text-sm last:border-b-0">
            <dt className="text-text-2">{row.label}</dt>
            <dd className="text-right font-medium tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
      {sources.length > 0 ? (
        <p className="text-sm text-text-2">{tr("Da: {0}", { 0: sources.map(([key, amount]) => `${sourceNames[key] ?? ""} ${fmt.money(amount)}`).join(", ") })}</p>
      ) : null}
      {reminders ? (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 border-t pt-3 text-sm">
          <Checkbox checked={reminders.checked} onCheckedChange={(checked) => reminders.onChange(checked === true)} className="mt-0.5" />
          <span className="flex flex-col">
            <span className="font-medium text-foreground">{tr("Ricordamelo per email")}</span>
            <span className="text-text-3">{tr("A inizio mese a che punto sei, e un avviso quando lo raggiungi o la data si avvicina. Si spegne da Impostazioni o dal link in ogni email.")}</span>
          </span>
        </label>
      ) : null}
    </>
  );
}
