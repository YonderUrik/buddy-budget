"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Titolo di Analitiche: l'anno in cui puoi smettere di lavorare con le ipotesi in uso, e di quanto cambia rispetto a quelle salvate. */

import { AnimatedNumber, TextMorph } from "@/components/motion";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { cn } from "@/lib/utils";
import { localizedAnalyticsFormats, formatYears } from "./analytics-format";

export interface ScenarioHeadlineProps {
  /** Piano con i valori dei cursori. */
  plan: AnalyticsPlan;
  /** Piano salvato, per dire quanto si guadagna o si perde. */
  baseline: AnalyticsPlan;
  today: Date;
}

/** Cosa dire del cambio di anni rispetto alle ipotesi salvate; null se invariato o non confrontabile. */
function comparison(plan: AnalyticsPlan, baseline: AnalyticsPlan): { text: string; positive: boolean } | null {
  if (plan.yearsToFire === null || baseline.yearsToFire === null) return null;
  const diff = baseline.yearsToFire - plan.yearsToFire;
  if (Math.abs(diff) < 0.05) return null;
  return { text: `${formatYears(Math.abs(diff))} ${diff > 0 ? "prima" : "dopo"} delle ipotesi salvate`, positive: diff > 0 };
}

export function ScenarioHeadline({ plan, baseline, today }: ScenarioHeadlineProps) {
  const { formatYears } = localizedAnalyticsFormats(useLocalization().language);

  const { t: tr } = useLocalization();
  if (plan.target === null) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground">{tr("Quando puoi smettere di lavorare")}</p>
        <p className="font-heading text-2xl font-medium text-foreground">{tr("Mi serve la tua spesa annua")}</p>
        <p className="text-sm text-muted-foreground">{tr("Registra almeno 3 mesi di movimenti oppure scrivila in «Tutte le ipotesi».")}</p>
      </div>
    );
  }
  const years = plan.yearsToFire;
  const cmp = comparison(plan, baseline);
  const year = years === null || years === 0 ? null : today.getFullYear() + Math.ceil(years);
  const big =
    years === null ? tr("Oltre 80 anni") : year === null ? tr("Già oggi") : <AnimatedNumber value={year} format={{ useGrouping: false }} />;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground">{years === 0 ? tr("Hai già raggiunto il numero FIRE") : tr("Puoi smettere di lavorare intorno al")}</p>
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-heading text-5xl leading-none font-medium tracking-tight text-foreground tabular-nums sm:text-7xl">{big}</span>
        {years !== null && years > 0 ? <TextMorph className="text-lg text-muted-foreground">{tr("tra {0}", {0: formatYears(years)})}</TextMorph> : null}
        {cmp ? <TextMorph className={cn("text-lg font-semibold", cmp.positive ? "text-pos" : "text-neg")}>{cmp.text}</TextMorph> : null}
      </p>
    </div>
  );
}
