"use client";

/** Anno per anno: quanto hai versato e quanto ha reso il fondo, in barre impilate (il rendimento negativo scende sotto lo zero). */

import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { YearBreakdown } from "@/lib/calc/pension";
import { formatSignedPercent, money } from "./pension-format";

export interface PensionYearlyCardProps {
  years: YearBreakdown[];
  currency: string;
}

const CHART_CONFIG: ChartConfig = {
  contributions: { label: "Versato", color: "var(--primary)" },
  gainPos: { label: "Rendimento", color: "var(--pos)" },
  gainNeg: { label: "Perdita", color: "var(--neg)" },
};

export function PensionYearlyCard({ years, currency }: PensionYearlyCardProps) {
  const data = years.map((row) => ({
    label: row.partial ? `${row.year}*` : String(row.year),
    contributions: row.contributions,
    gainPos: Math.max(0, row.gain),
    gainNeg: Math.min(0, row.gain),
    gain: row.gain,
  }));
  const best = years.length > 0 ? years.reduce((a, b) => (b.gain > a.gain ? b : a)) : null;
  const worst = years.length > 0 ? years.reduce((a, b) => (b.gain < a.gain ? b : a)) : null;
  const returnOn = (row: YearBreakdown) => (row.endValue - row.gain > 0 ? row.gain / (row.endValue - row.gain) : null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anno per anno</CardTitle>
        <p className="text-sm text-muted-foreground">Quanto hai versato e quanto ha reso il fondo in ogni anno. * anno in corso.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={CHART_CONFIG} className="max-h-60 w-full">
          <BarChart data={data} stackOffset="sign">
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis hide />
            <ReferenceLine y={0} stroke="var(--border)" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" formatter={(v) => money(Number(v), currency)} />} />
            <Bar dataKey="contributions" stackId="a" fill="var(--color-contributions)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="gainPos" stackId="a" fill="var(--color-gainPos)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gainNeg" stackId="a" fill="var(--color-gainNeg)" radius={[0, 0, 4, 4]} />
          </BarChart>
        </ChartContainer>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" aria-hidden="true" />Versato</li>
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-pos" aria-hidden="true" />Rendimento</li>
          <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-neg" aria-hidden="true" />Perdita</li>
        </ul>
        {best && worst && years.length > 1 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Anno migliore</p>
              <p className="font-heading text-lg font-medium tabular-nums text-pos">{best.year} · {best.gain >= 0 ? "+" : "−"}{money(Math.abs(best.gain), currency)}{returnOn(best) !== null ? <span className="text-sm text-muted-foreground"> ({formatSignedPercent(returnOn(best)!)})</span> : null}</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Anno peggiore</p>
              <p className={`font-heading text-lg font-medium tabular-nums ${worst.gain < 0 ? "text-neg" : "text-foreground"}`}>{worst.year} · {worst.gain >= 0 ? "+" : "−"}{money(Math.abs(worst.gain), currency)}{returnOn(worst) !== null ? <span className="text-sm text-muted-foreground"> ({formatSignedPercent(returnOn(worst)!)})</span> : null}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
