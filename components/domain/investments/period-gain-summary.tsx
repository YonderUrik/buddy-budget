import { formatCurrency } from "@/lib/format";
import type { PeriodGain } from "@/lib/investments/period-gain";
import { parseDateOnly } from "@/lib/calc/expenses";
import { cn } from "@/lib/utils";

const DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });

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
  const money = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const positive = gain.gain >= 0;
  const added = gain.netContributions;
  return (
    <p className="max-w-prose text-balance text-base text-foreground">
      Da {DATE_FORMAT.format(parseDateOnly(gain.fromKey))} il valore è passato da{" "}
      <span className="font-semibold tabular-nums">{money(gain.startValue)}</span> a{" "}
      <span className="font-semibold tabular-nums">{money(gain.endValue)}</span>.
      {Math.abs(added) >= 0.5 ? <> Nel periodo hai {added > 0 ? "versato" : "ritirato"} {money(Math.abs(added))}: quello non è guadagno.</> : null}{" "}
      Il periodo ha {positive ? "reso" : "perso"}{" "}
      <span className={cn("font-semibold tabular-nums", positive ? "text-pos" : "text-neg")}>
        {positive ? "+" : "−"}
        {money(Math.abs(gain.gain))}
        {gain.twr !== null ? ` (${pctText(gain.twr)})` : ""}
      </span>
      {gain.income > 0.5 ? <span className="text-muted-foreground">, compresi {money(gain.income)} tra dividendi e cedole</span> : null}
      .
    </p>
  );
}
