"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/** Le cifre di un finanziamento: anello di avanzamento col residuo, poi rata, tasso e TAEG, rate rimaste, fine e interessi che restano. */

import { MoneyHero } from "@/components/domain/net-worth";
import type { DebtView } from "@/lib/debts/view";
import { repaidShare } from "@/lib/debts/overview-insights";

export { repaidShare };

import { DebtRing } from "./debt-ring";
import { localizedDebtFormats } from "./debts-format";

export interface DebtFactsProps {
  debt: DebtView;
  currency: string;
}

export function DebtFacts({ debt, currency }: DebtFactsProps) {
  const { formatMonthYear } = localizedDebtFormats(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency, formatRatio } = localizedFormats(formattingLocale);
  const percent = (value: number) => `${formatRatio(value, 2)}%`;

  const { t: tr } = useLocalization();
  const t = debt.plan.totals;
  const share = repaidShare(debt);
  const facts = [
    { label: tr("Rata"), value: t.finished ? "—" : formatCurrency(t.currentInstallment, currency) },
    { label: tr("Rate rimaste"), value: String(t.remainingInstallments) },
    { label: tr("Tasso (TAN) · TAEG"), value: `${percent(debt.annualRate)} · ${debt.apr !== null ? percent(debt.apr) : "—"}` },
    { label: tr("Interessi che restano"), value: formatCurrency(t.interestRemaining, currency, { maximumFractionDigits: 0 }), tone: "text-neg" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <DebtRing fraction={share} label={`${Math.round(share * 100)}%`} caption="restituito" />
        <div className="min-w-0">
          <MoneyHero value={t.residual} currency={currency} className="text-4xl sm:text-5xl" />
          <p className="text-sm text-muted-foreground">{t.finished ? tr("Estinto") : tr("ancora da restituire · finisce a {0}", {0: formatMonthYear(t.endDate)})}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 pt-4 sm:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs text-muted-foreground">{tr(fact.label)}</dt>
            <dd className={`font-heading text-base font-medium tabular-nums ${fact.tone ?? "text-foreground"}`}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
