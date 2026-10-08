"use client";
import { track } from "@/lib/analytics";
import { useMemo } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { GitCompareArrowsIcon } from "lucide-react";
import { PanelSection } from "./panel-section";
import { useBrokerSelection } from "@/lib/investments/broker-selection";
import { brokerComparison } from "@/lib/investments/broker-comparison";
import { investmentBrokerGroups } from "@/lib/investments/broker-filter";
import type { InvestmentData } from "@/lib/investments/data";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const percent = (value: number) => `${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%`;

/** Broker returns overlaid in the same currency and period, using the app's existing TWR calculation. */
export function BrokerComparisonCard({ data, period, today }: { data: InvestmentData; period: NetWorthPeriod; today: Date }) {
  const { overlay, setOverlay } = useBrokerSelection();
  const hasBrokers = useMemo(() => investmentBrokerGroups(data).some((g) => g.id !== "manual"), [data]);
  const comparison = useMemo(() => overlay && hasBrokers ? brokerComparison(data, period, today) : null, [data, period, today, overlay, hasBrokers]);
  if (!hasBrokers) return null;
  const config: ChartConfig = Object.fromEntries((comparison?.lines ?? []).map((line, index) => [line.key, { label: line.label, color: line.key === "combined" ? "var(--foreground)" : COLORS[index % COLORS.length] }]));
  return <PanelSection
    icon={GitCompareArrowsIcon}
    title="Confronto tra broker"
    color="var(--swatch-indigo)"
    action={<label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={overlay} onChange={(e) => { setOverlay(e.target.checked); track("investment_broker_overlay_changed", { enabled: e.target.checked }); }} />Sovrapponi i rendimenti dei broker selezionati</label>}
  >
    {comparison ? <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Rendimento percentuale corretto per acquisti e vendite, nella valuta del portafoglio. Il totale combinato è ricalcolato, non è la somma delle percentuali. Ogni linea mostra soltanto lo storico disponibile nel periodo; con Max i broker possono iniziare in date diverse. Sono calcoli dell’app, non valori certificati dai broker.</p>
      {comparison.points.length > 1 ? <ChartContainer config={config} className="h-64 w-full"><LineChart data={comparison.points}>
        <XAxis dataKey="time" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(value: number) => new Date(value).toLocaleDateString("it-IT", { day: "numeric", month: "short", ...(period === "max" ? { year: "2-digit" as const } : {}) })} tickLine={false} axisLine={false} minTickGap={30} />
        <YAxis tickFormatter={percent} width={60} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => new Date(Number(value)).toLocaleDateString("it-IT")} formatter={(value, name) => <span>{config[String(name)]?.label}: {percent(Number(value))}</span>} />} />
        {comparison.lines.map((line) => <Line key={line.key} dataKey={line.key} name={line.key} stroke={`var(--color-${line.key})`} strokeWidth={2} strokeDasharray={line.key === "combined" ? "5 4" : undefined} dot={false} connectNulls isAnimationActive={false} />)}
      </LineChart></ChartContainer> : <p className="text-sm">Storico insufficiente per confrontare i rendimenti.</p>}
      <ul className="flex flex-wrap gap-4 text-sm">{comparison.lines.map((line) => <li key={line.key} className="flex items-center gap-2"><span className="inline-block h-0.5 w-4" style={{ backgroundColor: config[line.key].color }} aria-hidden="true" />{line.label}: {line.twr === null ? "Non disponibile" : percent(line.twr * 100)}</li>)}</ul>
    </div> : null}
  </PanelSection>;
}
