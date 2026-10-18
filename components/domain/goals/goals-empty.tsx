"use client";

/**
 * Vista Obiettivi senza obiettivi: cosa si ottiene e, se sappiamo le spese dovute e non c'è ancora, il consiglio di
 * partire dal fondo di emergenza con la cifra già calcolata.
 */

import { ShieldCheckIcon, TargetIcon } from "lucide-react";
import { EmptyState } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { DEFAULT_EMERGENCY_MONTHS, type GoalKind } from "@/lib/goals/constants";
import type { GoalsView } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import { emergencyTarget } from "./goal-form-state";
import type { GoalFormatters } from "./goal-format";
import { GoalIcon } from "./goal-icon";

export interface GoalsEmptyProps {
  view: GoalsView;
  fmt: GoalFormatters;
  onNew: (kind?: GoalKind) => void;
}

export function GoalsEmpty({ view, fmt, onNew }: GoalsEmptyProps) {
  const { t: tr } = useLocalization();
  const free = view.sources.filter((s) => s.kind === "account").reduce((sum, s) => sum + s.free, 0);
  const values = view.essentialMonthly === null ? null : { 0: DEFAULT_EMERGENCY_MONTHS, 1: fmt.money(emergencyTarget(view.essentialMonthly, DEFAULT_EMERGENCY_MONTHS)), 2: fmt.money(free) };
  const emergencyText =
    values === null
      ? null
      : view.essentialBasis === "tutte"
        ? tr("Con {0} mesi delle tue spese sarebbero circa {1}. Sui conti hai {2} che nessun obiettivo usa ancora.", values)
        : tr("Con {0} mesi di spese dovute sarebbero circa {1}. Sui conti hai {2} che nessun obiettivo usa ancora.", values);
  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        icon={TargetIcon}
        color="var(--swatch-amber)"
        title={tr("Dai un nome ai tuoi risparmi")}
        description={tr("Un viaggio, l'anticipo di casa, un fondo per gli imprevisti: scegli quanto ti serve e da dove arrivano i soldi (conti o investimenti). Ti diciamo quando ci arrivi, se il risparmio basta per tutto e di quanto ogni obiettivo sposta il giorno in cui puoi smettere di lavorare.")}
        primary={{ label: tr("Nuovo obiettivo"), onClick: () => onNew() }}
      />
      {emergencyText !== null ? (
        <div className="flex gap-3 pt-6">
          <GoalIcon icon={ShieldCheckIcon} color="var(--swatch-teal)" />
          <div className="flex min-w-0 flex-col items-start gap-2">
            <p className="font-medium text-foreground">{tr("Da dove partire: un fondo di emergenza")}</p>
            <p className="text-sm text-text-2">
              {emergencyText}
            </p>
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => onNew("emergenza")}>
              {tr("Crea il fondo di emergenza")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
