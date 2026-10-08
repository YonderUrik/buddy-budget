"use client";

/** Anno per anno: quanto hai versato e quanto ha reso il fondo, in barre impilate (il rendimento negativo scende sotto lo zero). */

import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartNoAxesColumnIcon } from "lucide-react";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { YearBreakdown } from "@/lib/calc/pension";
import { formatSignedPercent, money } from "./pension-format";
import { PensionSection } from "./pension-section";
import { PensionYearlyTooltip } from "./pension-yearly-tooltip";

export interface PensionYearlyCardProps {
  years: YearBreakdown[];
  currency: string;
}

const CHART_CONFIG: ChartConfig = {
  contributions: { label: "Versato", color: "var(--primary)" },
  gainPos: { label: "Rendimento", color: "var(--pos)" },
  gainNeg: { label: "Perdita", color: "var(--neg)" },
};

const CHART_HEIGHT = 240;

export function PensionYearlyCard({ years, currency }: PensionYearlyCardProps) {
  const data = years.map((row) => ({
    label: row.partial ? `${row.year}*` : String(row.year),
    contributions: row.contributions,
    gainPos: Math.max(0, row.gain),
    gainNeg: Math.min(0, row.gain),
    gain: row.gain,
    returnRate: row.returnRate,
    partial: row.partial,
  }));
  const best = years.length > 0 ? years.reduce((a, b) => (b.gain > a.gain ? b : a)) : null;
  const worst = years.length > 0 ? years.reduce((a, b) => (b.gain < a.gain ? b : a)) : null;
  return (
    <PensionSection
      icon={ChartNoAxesColumnIcon}
      title="Anno per anno"
      color="var(--swatch-green)"
      description="Quanto hai versato e quanto ha reso il fondo in ogni anno, anche in percentuale: rendimento diviso per il valore a inizio anno più i versamenti. * anno in corso, non annualizzato."
    >
      <div className="flex flex-col gap-4">
        <div className="-mx-4 sm:-mx-6">
          <ChartContainer config={CHART_CONFIG} className="w-full" style={{ height: CHART_HEIGHT }}>
            <BarChart data={data} stackOffset="sign" margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} padding={{ left: 16, right: 16 }} />
              <YAxis hide />
              <ReferenceLine y={0} stroke="var(--border)" />
              <ChartTooltip cursor={false} content={<PensionYearlyTooltip currency={currency} />} />
              <Bar dataKey="contributions" stackId="a" fill="var(--color-contributions)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="gainPos" stackId="a" fill="var(--color-gainPos)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gainNeg" stackId="a" fill="var(--color-gainNeg)" radius={[0, 0, 4, 4]} />
            </BarChart>
          </ChartContainer>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-text-2">
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" aria-hidden="true" />Versato</li>
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-pos" aria-hidden="true" />Rendimento</li>
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-neg" aria-hidden="true" />Perdita</li>
        </ul>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm" aria-label="Rendimento percentuale per anno">
          {data.map((row) => (
            <li key={row.label} className="flex items-baseline gap-1.5">
              <span className="text-text-2">{row.label}</span>
              <span className={`font-semibold tabular-nums ${row.returnRate === null ? "text-text-2" : row.gain < 0 ? "text-neg" : "text-pos"}`}>{row.returnRate !== null ? formatSignedPercent(row.returnRate) : "n.d."}</span>
            </li>
          ))}
        </ul>
        {best && worst && years.length > 1 ? (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div className="border-t border-border pt-3">
              <dt className="text-sm text-text-2">Anno migliore</dt>
              <dd className="font-heading text-xl font-medium tabular-nums text-pos">{best.year} · {best.gain >= 0 ? "+" : "−"}{money(Math.abs(best.gain), currency)}{best.returnRate !== null ? <span className="text-sm text-text-2"> ({formatSignedPercent(best.returnRate)})</span> : null}</dd>
            </div>
            <div className="border-t border-border pt-3">
              <dt className="text-sm text-text-2">Anno peggiore</dt>
              <dd className={`font-heading text-xl font-medium tabular-nums ${worst.gain < 0 ? "text-neg" : "text-foreground"}`}>{worst.year} · {worst.gain >= 0 ? "+" : "−"}{money(Math.abs(worst.gain), currency)}{worst.returnRate !== null ? <span className="text-sm text-text-2"> ({formatSignedPercent(worst.returnRate)})</span> : null}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </PensionSection>
  );
}
