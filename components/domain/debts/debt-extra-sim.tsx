"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** "Versare di più ogni mese" su un finanziamento: uno slider e, subito, quanto prima finisci e quanti interessi risparmi. */

import * as React from "react";
import { Slider } from "@/components/ui/slider";
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
        <p className="text-sm text-foreground">{tr("Finisci")}{" "}<strong className="font-medium">{formatDuration(monthsSaved)}{" "}{tr("prima")}</strong> {"("}{formatMonthYear(result.faster.endDate)}{" "}{tr("invece di")}{" "}{formatMonthYear(result.base.endDate)}{tr(") e risparmi")}{" "}
          <strong className="font-medium tabular-nums text-pos">{money(saved)}</strong>{" "}{tr("di interessi.")}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{tr("Muovi lo slider per vedere quanto anticipi la fine e quanto risparmi.")}</p>
      )}
      <p className="text-xs text-muted-foreground">{tr("Stima semplificata: rata e tasso costanti, nessuna penale.")}</p>
    </div>
  );
}
