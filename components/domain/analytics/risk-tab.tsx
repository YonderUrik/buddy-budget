"use client";

/** Scheda Rischio: oscillazioni, perdite nei giorni peggiori, concentrazione e contributo di ogni posizione. */

import type { AnalyticsBase } from "@/lib/analitiche/base";
import { AnalyticsCard, Metric, MissingData } from "./analytics-card";
import { num, pct } from "./analytics-format";

export interface RiskTabProps {
  base: AnalyticsBase;
  /** Volatilità ipotizzata, per confrontarla con quella osservata. */
  assumedVolatility: number;
}

export function RiskTab({ base, assumedVolatility }: RiskTabProps) {
  const { risk, riskContribution, names } = base;
  if (!risk) return <MissingData>Servono operazioni di investimento e almeno qualche settimana di prezzi per misurare il rischio del portafoglio.</MissingData>;
  const dash = (v: number | null, fmt: (x: number) => string) => (v === null ? "—" : fmt(v));
  return (
    <div className="flex flex-col gap-4">
      <AnalyticsCard title="Rischio del portafoglio" explainer="risk">
        {risk.fewData ? <p className="text-sm text-neg">Meno di un anno di dati: i numeri sono indicativi.</p> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Volatilità annua" value={dash(risk.volatility, (v) => pct(v))} sub={`ipotizzata ${pct(assumedVolatility, 0)}`} />
          <Metric label="Peggior calo" value={dash(risk.maxDrawdown, (v) => `−${pct(v)}`)} tone="neg" sub="dal picco al minimo" />
          <Metric label="Sharpe" value={dash(risk.sharpe, (v) => num(v))} sub="rendimento per unità di rischio" />
          <Metric label="Sortino" value={dash(risk.sortino, (v) => num(v))} sub="conta solo i ribassi" />
          <Metric label="Calmar" value={dash(risk.calmar, (v) => num(v))} sub={risk.annualReturn !== null ? `rendimento annuo ${pct(risk.annualReturn)}` : undefined} />
          <Metric label="VaR 95% (giorno)" value={risk.tail ? `−${pct(risk.tail.var)}` : "—"} tone="neg" sub="nel 5% dei giorni peggiori si perde almeno" />
          <Metric label="CVaR 95% (giorno)" value={risk.tail ? `−${pct(risk.tail.cvar)}` : "—"} tone="neg" sub="perdita media in quei giorni" />
          <Metric label="Posizioni effettive" value={risk.concentration ? num(risk.concentration.effectiveN, 1) : "—"} sub="1 = tutto su un titolo" />
        </div>
        {risk.volatility !== null && Math.abs(risk.volatility - assumedVolatility) > 0.05 ? (
          <p className="text-sm text-muted-foreground">
            La volatilità osservata ({pct(risk.volatility, 0)}) è lontana da quella che hai ipotizzato ({pct(assumedVolatility, 0)}): se la tua vera tolleranza è quella osservata, aggiorna l&apos;ipotesi per rendere la simulazione più realistica.
          </p>
        ) : null}
      </AnalyticsCard>

      <AnalyticsCard title="Quanto ogni posizione pesa sul rischio">
        {riskContribution ? (
          <ul className="flex flex-col gap-2">
            {[...riskContribution]
              .sort((a, b) => b.riskShare - a.riskShare)
              .map((c) => (
                <li key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{names[c.id] ?? c.id}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {pct(c.riskShare, 0)} del rischio · {pct(c.weight, 0)} del valore
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(c.riskShare, 1) * 100}%` }} />
                    <div className="absolute -inset-y-0.5 w-0.5 bg-foreground/60" style={{ left: `${Math.min(c.weight, 1) * 100}%` }} title="Peso sul valore" />
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <MissingData>Servono almeno due posizioni con 60 giorni di prezzi in comune.</MissingData>
        )}
        <p className="text-xs text-muted-foreground">La barra piena è il peso sul rischio, il trattino il peso sul valore: se la barra supera il trattino, quella posizione pesa sul rischio più di quanto pesi sul valore.</p>
      </AnalyticsCard>
    </div>
  );
}
