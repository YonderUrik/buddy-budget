"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * "Come uscirne prima": uno slider per l'extra al mese e il percorso a tappe (valanga: l'extra e le rate liberate vanno
 * al tasso più alto). Per ogni debito dice quando si chiude e quanto anticipa; in fondo la data libera e gli interessi risparmiati.
 */

import * as React from "react";
import { RouteIcon } from "lucide-react";
import { PanelSection } from "@/components/domain/investments/light";
import { Slider } from "@/components/ui/slider";
import { track } from "@/lib/analytics";
import { todayIso } from "@/lib/debts/dates";
import { buildExitPlan } from "@/lib/debts/overview-insights";
import type { DebtView } from "@/lib/debts/view";

import { formatDuration, formatMonthYear } from "./debts-format";
import { DEBTS_COLORS } from "./debts-theme";

export interface DebtsExitCardProps {
  debts: DebtView[];
  currency: string;
}

const EXTRA_DEFAULT = 200;
const EXTRA_MAX = 1000;
const EXTRA_STEP = 50;

export function DebtsExitCard({ debts, currency }: DebtsExitCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [extra, setExtra] = React.useState(EXTRA_DEFAULT);
  const tracked = React.useRef(false);
  const plan = React.useMemo(() => buildExitPlan(debts, extra, todayIso()), [debts, extra]);
  if (!plan) return null;
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  const onChange = (value: number | readonly number[]) => {
    setExtra(Array.isArray(value) ? value[0] : (value as number));
    if (!tracked.current) {
      tracked.current = true;
      track("debt_exit_plan_used");
    }
  };
  return (
    <PanelSection
      icon={RouteIcon}
      title={tr("Come uscirne prima")}
      color={DEBTS_COLORS.exit}
      description={tr("Quanto potresti mettere in più ogni mese? Quell'extra e le rate dei debiti che chiudi vanno prima al tasso più alto.")}
      className="gap-4"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span id="exit-extra-label" className="text-xs font-medium text-muted-foreground">{tr("Extra al mese")}</span>
          <span className="font-heading text-xl font-medium tabular-nums text-foreground">{money(extra)}</span>
        </div>
        <Slider value={[extra]} min={0} max={EXTRA_MAX} step={EXTRA_STEP} onValueChange={onChange} aria-labelledby="exit-extra-label" />
      </div>
      <ol className="flex flex-col">
        {plan.steps.map((step, index) => (
          <li key={step.id} className="relative flex items-center gap-3 py-2.5">
            {index < plan.steps.length - 1 ? <span className="absolute left-[8px] top-8 -bottom-2.5 w-0.5 bg-border" aria-hidden="true" /> : null}
            <span className="size-[18px] shrink-0 rounded-full border-[3px] border-background bg-primary ring-2 ring-border" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{step.name}</p>
              <p className="text-xs text-muted-foreground">{tr("Chiuso a")}{" "}{formatMonthYear(step.endDate)}
                {step.monthsSaved > 0 ? tr(" invece di {0}", {0: formatMonthYear(step.baselineEndDate)}) : ""}
              </p>
            </div>
            {step.monthsSaved > 0 ? <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">−{formatDuration(step.monthsSaved)}</span> : null}
          </li>
        ))}
      </ol>
      <div className="flex justify-between gap-3 border-t pt-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tr("Libero da debiti")}</p>
          <p className="font-heading text-xl font-medium text-foreground">{formatMonthYear(plan.endDate)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tr("Interessi risparmiati")}</p>
          <p className="font-heading text-xl font-medium tabular-nums text-pos">{money(plan.interestSaved)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{tr("Stima semplificata (rate e tassi costanti, nessuna penale): serve a confrontare, non a prevedere gli importi esatti.")}</p>
    </PanelSection>
  );
}
