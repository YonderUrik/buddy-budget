"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** "Pay more every month" on a loan: a slider and, right away, how much sooner it ends and how much interest is saved. */

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { SimulationResult } from "@/components/domain/shared";
import { simulatePayoff } from "@/lib/calc/debt-simulator";
import { todayIso } from "@/lib/debts/dates";
import type { DebtView } from "@/lib/debts/view";

import { localizedDebtFormats } from "./debts-format";

export interface DebtExtraSimProps {
  debt: DebtView;
  currency: string;
}

const EXTRA_DEFAULT = 200;
const EXTRA_MAX = 1000;
const EXTRA_STEP = 50;

export function DebtExtraSim({ debt, currency }: DebtExtraSimProps) {
  const { formatDuration, formatMonthYear } = localizedDebtFormats(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [extra, setExtra] = React.useState(EXTRA_DEFAULT);
  const id = React.useId();
  const t = debt.plan.totals;
  const result = React.useMemo(() => {
    const loan = [{ id: debt.id, name: debt.name, residual: t.residual, annualRate: debt.annualRate, installment: t.currentInstallment }];
    const today = todayIso();
    return { base: simulatePayoff(loan, 0, "none", today), faster: simulatePayoff(loan, extra, "avalanche", today) };
  }, [debt, t.residual, t.currentInstallment, extra]);
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  const monthsSaved = result.base.months - result.faster.months;
  const saved = result.base.totalInterest - result.faster.totalInterest;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span id={id} className="text-xs font-medium text-muted-foreground">{tr("Extra al mese")}</span>
          <span className="font-heading text-xl font-medium tabular-nums text-foreground">{money(extra)}</span>
        </div>
        <Slider value={[extra]} min={0} max={EXTRA_MAX} step={EXTRA_STEP} onValueChange={(v) => setExtra(Array.isArray(v) ? v[0] : (v as number))} aria-labelledby={id} />
      </div>
      {extra > 0 && monthsSaved > 0 ? (
        <SimulationResult
          label={tr("Finisci prima di")}
          value={formatDuration(monthsSaved)}
          caption={tr("{0} invece di {1}, e risparmi {2} di interessi.", {0: formatMonthYear(result.faster.endDate), 1: formatMonthYear(result.base.endDate), 2: money(saved)})}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{tr("Muovi lo slider per vedere quanto anticipi la fine e quanto risparmi.")}</p>
      )}
      <p className="text-xs text-muted-foreground">{tr("Stima semplificata: rata e tasso costanti, nessuna penale.")}</p>
    </div>
  );
}
