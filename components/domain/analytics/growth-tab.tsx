"use client";


import { useLocalization } from "@/lib/localization/provider";

/** Scheda Crescita: quanto dell'aumento del patrimonio finanziario viene dal risparmio e quanto dal mercato. */

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnalyticsBase } from "@/lib/analitiche/base";
import { splitGrowth } from "@/lib/calc/growth-split";
import { AnalyticsCard, Metric, MissingData } from "./analytics-card";
import { localizedAnalyticsFormats } from "./analytics-format";
import { GuidedReading } from "./guided-reading";
import { localizedGuidedSteps } from "./guided-steps";

export interface GrowthTabProps {
  base: AnalyticsBase;
}

const CONFIG: ChartConfig = {
  fromSavings: { label: "Dal risparmio", color: "var(--primary)" },
  fromMarket: { label: "Da mercato e altro", color: "var(--swatch-teal)" },
};




export function GrowthTab({ base }: GrowthTabProps) {
  const { growthSteps } = localizedGuidedSteps(useLocalization().language);

  const { money, pct } = localizedAnalyticsFormats(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const monthLabel = (key: string) =>
  MONTH_FORMAT.format(new Date(`${key}-01T00:00:00Z`)).replace(".", "");
  const MONTH_FORMAT = new Intl.DateTimeFormat(formattingLocale, {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

  const { t: tr } = useLocalization();
  const { currency } = base;
  const split = splitGrowth(base.growthPoints);
  if (split.rows.length < 2) {
    return (
      <MissingData>{tr("Servono almeno due mesi di storico del patrimonio e dei movimenti. Con i conti collegati o qualche mese di uso la scheda si riempie da sola.")}</MissingData>
    );
  }
  const data = split.rows.map((r) => ({ ...r, label: monthLabel(r.month) }));
  return (
    <div className="flex flex-col gap-4">
      <GuidedReading tab="crescita" steps={growthSteps(split, currency)} />
      <AnalyticsCard title={tr("Da dove arriva la crescita")} explainer="growth">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric
            label={tr("Variazione del patrimonio")}
            value={money(split.totalDelta, currency)}
            tone={split.totalDelta >= 0 ? "pos" : "neg"}
            sub="liquidità + investimenti, ultimi 12 mesi"
          />
          <Metric
            label={tr("Dal tuo risparmio")}
            value={money(split.totalFromSavings, currency)}
            sub={
              split.savingsShare !== null
                ? tr("{0} della crescita", {0: pct(split.savingsShare, 0)})
                : undefined
            }
          />
          <Metric
            label={tr("Da mercato e altro")}
            value={money(split.totalFromMarket, currency)}
            tone={split.totalFromMarket >= 0 ? "pos" : "neg"}
            sub="per differenza"
          />
        </div>
        <ChartContainer config={CONFIG} className="h-64 w-full">
          <BarChart data={data} stackOffset="sign">
            <CartesianGrid vertical={false} strokeOpacity={0.3} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis hide />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-medium">{p.label}</p>
                    <p>{tr("Dal risparmio:")}{" "}{money(p.fromSavings, currency)}</p>
                    <p>{tr("Da mercato e altro:")}{" "}{money(p.fromMarket, currency)}</p>
                    <p>{tr("Variazione totale:")}{" "}{money(p.delta, currency)}</p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="fromSavings"
              stackId="g"
              fill="var(--color-fromSavings)"
              isAnimationActive={false}
            />
            <Bar
              dataKey="fromMarket"
              stackId="g"
              fill="var(--color-fromMarket)"
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </AnalyticsCard>
    </div>
  );
}
