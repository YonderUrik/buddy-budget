"use client";

/** Scheda Costi e tasse: costo annuo del portafoglio, erosione nel tempo e imposta se vendessi tutto oggi. */

import * as React from "react";
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsBase } from "@/lib/analitiche/base";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { costDrag, summarizeCosts } from "@/lib/calc/costs";
import { AnalyticsCard, Metric, MissingData } from "./analytics-card";
import { money, pct } from "./analytics-format";
import { parseNumber, toFieldText } from "./assumptions-fields";
import { GuidedReading } from "./guided-reading";
import { costsSteps } from "./guided-steps";

export interface CostsTabProps {
  base: AnalyticsBase;
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  saving: boolean;
  error: string | null;
  onSaveTer: (terByInstrument: Record<string, number>) => Promise<void>;
}

const DRAG_YEARS = 30;
const CONFIG: ChartConfig = {
  withoutCosts: { label: "Senza costi", color: "var(--swatch-teal)" },
  withCosts: { label: "Con i tuoi costi", color: "var(--primary)" },
};

export function CostsTab({ base, assumptions, plan, saving, error, onSaveTer }: CostsTabProps) {
  const { currency } = base;
  const [drafts, setDrafts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(assumptions.terByInstrument).map(([id, ter]) => [id, toFieldText(ter, true)]))
  );
  const [localError, setLocalError] = React.useState<string | null>(null);
  const positions = base.positions.map((p) => ({ ...p, ter: assumptions.terByInstrument[p.id] ?? null }));
  const summary = summarizeCosts(positions);
  if (positions.length === 0) return <MissingData>Servono posizioni di investimento aperte per calcolare costi e imposte.</MissingData>;

  const save = async () => {
    setLocalError(null);
    const next: Record<string, number> = {};
    for (const p of positions) {
      const text = drafts[p.id];
      if (text === undefined || text.trim() === "") continue;
      const value = parseNumber(text);
      if (value === null || value < 0 || value > 5) {
        setLocalError(`Costo di «${p.name}»: inserisci un valore tra 0% e 5%.`);
        return;
      }
      next[p.id] = value / 100;
    }
    await onSaveTer(next).catch(() => undefined);
  };

  const drag = summary.annualPct !== null ? costDrag(summary.totalValue, assumptions.expectedReturn, summary.annualPct, DRAG_YEARS) : [];
  const last = drag.at(-1);
  const { liquidation } = plan;

  return (
    <div className="flex flex-col gap-4">
      <GuidedReading tab="costi" steps={costsSteps(summary, drag, liquidation, currency, DRAG_YEARS)} />
      <AnalyticsCard title="Costi del portafoglio" explainer="costs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Costo annuo" value={money(summary.annualCost, currency)} sub={summary.annualPct !== null ? `${pct(summary.annualPct, 2)} del portafoglio` : undefined} />
          <Metric label={`Persi in ${DRAG_YEARS} anni`} value={last ? money(last.lost, currency) : "—"} tone="neg" sub="rispetto allo stesso portafoglio senza costi" />
          <Metric label="Senza costo inserito" value={money(summary.missingTerValue, currency)} sub="valore delle posizioni senza costo inserito" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-2 font-medium">Posizione</th>
                <th className="p-2 text-right font-medium">Valore</th>
                <th className="p-2 font-medium">Costo annuo fondo (TER, %)</th>
                <th className="p-2 text-right font-medium">Costo totale/anno</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const row = summary.rows.find((r) => r.id === p.id);
                return (
                  <tr key={p.id} className="border-t">
                    <th scope="row" className="max-w-48 truncate p-2 text-left font-medium">{p.name}</th>
                    <td className="p-2 text-right">{money(p.value, currency)}</td>
                    <td className="p-2">
                      <Input
                        aria-label={`Costo annuo di ${p.name}`}
                        className="h-8 w-24"
                        inputMode="decimal"
                        placeholder="es. 0,20"
                        value={drafts[p.id] ?? ""}
                        onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                      />
                    </td>
                    <td className="p-2 text-right">{row ? money(row.total, currency) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Il TER lo trovi nel KID/scheda del fondo (per un ETF globale di solito 0,1-0,4%). Il bollo (0,2%) è incluso per i titoli in deposito; è escluso per le crypto.</p>
        {localError || error ? <p className="text-sm text-neg" role="alert">{localError ?? error}</p> : null}
        <div>
          <Button onClick={save} disabled={saving}>{saving ? "Salvo…" : "Salva costi"}</Button>
        </div>
        {drag.length > 0 ? (
          <ChartContainer config={CONFIG} className="h-56 w-full">
            <ComposedChart data={drag}>
              <CartesianGrid vertical={false} strokeOpacity={0.3} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} tickFormatter={(y) => `${y}a`} minTickGap={24} />
              <YAxis hide domain={["auto", "auto"]} />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof drag)[number];
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="font-medium">Tra {p.year} anni</p>
                      <p>Senza costi: {money(p.withoutCosts, currency)}</p>
                      <p>Con costi: {money(p.withCosts, currency)}</p>
                      <p>Persi: {money(p.lost, currency)}</p>
                    </div>
                  );
                }}
              />
              <Line dataKey="withoutCosts" stroke="var(--color-withoutCosts)" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              <Line dataKey="withCosts" stroke="var(--color-withCosts)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ChartContainer>
        ) : null}
      </AnalyticsCard>

      <AnalyticsCard title="Se vendessi tutto oggi" explainer="liquidation">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Valore di mercato" value={money(liquidation.grossValue, currency)} />
          <Metric label="Imposta sulle plusvalenze" value={money(liquidation.latentTax, currency)} tone="neg" sub={liquidation.taxRatio !== null ? `${pct(liquidation.taxRatio)} del valore` : undefined} />
          <Metric label="Netto dopo le imposte" value={money(liquidation.netValue, currency)} />
        </div>
        {liquidation.byPosition.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {liquidation.byPosition.slice(0, 6).map((p) => (
              <li key={p.id} className="flex justify-between gap-3 border-t pt-1">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{money(p.tax, currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna plusvalenza non realizzata: nessuna imposta latente.</p>
        )}
      </AnalyticsCard>
    </div>
  );
}
