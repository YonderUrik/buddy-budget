"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

import type { PeriodGain } from "@/lib/investments/period-gain";
import { parseDateOnly } from "@/lib/calc/expenses";
import { cn } from "@/lib/utils";



export interface PeriodGainSummaryProps {
  gain: PeriodGain;
  currency: string;
}

function pctText(ratio: number): string {
  return `${ratio < 0 ? "−" : "+"}${Math.abs(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

/**
 * Frase del guadagno nel periodo scelto: da quanto a quanto è passato il valore, quanto ci hai messo tu e quanto ha
 * aggiunto il mercato (proventi inclusi). Al posto del guadagno totale quando il periodo non è «Tutto».
 */
export function PeriodGainSummary({ gain, currency }: PeriodGainSummaryProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);
  const DATE_FORMAT = new Intl.DateTimeFormat(formattingLocale, { day: "numeric", month: "short", year: "numeric" });

  const { t: tr } = useLocalization();
  const money = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const positive = gain.gain >= 0;
  const added = gain.netContributions;
  return (
    <p className="max-w-prose text-balance text-base text-foreground">{tr("Da")}{" "}{DATE_FORMAT.format(parseDateOnly(gain.fromKey))}{" "}{tr("il valore è passato da")}{" "}
      <span className="font-semibold tabular-nums">{money(gain.startValue)}</span>{" "}{tr("a")}{" "}
      <span className="font-semibold tabular-nums">{money(gain.endValue)}</span>.
      {Math.abs(added) >= 0.5 ? <>{" "}{tr("Nel periodo hai")}{" "}{added > 0 ? tr("versato") : tr("ritirato")}{" "}{money(Math.abs(added))}{tr(": quello non è guadagno.")}</> : null}{" "}{tr("Il periodo ha")}{" "}{positive ? tr("reso") : tr("perso")}{" "}
      <span className={cn("font-semibold tabular-nums", positive ? "text-pos" : "text-neg")}>
        {positive ? "+" : "−"}
        {money(Math.abs(gain.gain))}
        {gain.twr !== null ? ` (${pctText(gain.twr)})` : ""}
      </span>
      {gain.income > 0.5 ? <span className="text-muted-foreground">{tr(", compresi")}{" "}{money(gain.income)}{" "}{tr("tra dividendi e cedole")}</span> : null}
      .
    </p>
  );
}
