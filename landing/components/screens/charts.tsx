import { useId } from "react";
import { comparisonLines, debtStepsPath, netWorthChart } from "@/lib/charts";

/** Grafico del patrimonio netto d'esempio (liquidità, investimenti, linea tratteggiata del netto). */
export function NetWorthChart({ width = 840, height = 150 }: { width?: number; height?: number }) {
  const id = useId();
  const d = netWorthChart(width, height);
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height + 8}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--a-inv)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--a-inv)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d.areaTop} fill={`url(#${id})`} />
      <path className="dr" pathLength={1} d={d.lineTop} fill="none" stroke="var(--a-inv)" strokeWidth="2" />
      <path className="dr" pathLength={1} d={d.lineLiquidity} fill="none" stroke="var(--a-liq)" strokeWidth="2" />
      <path d={d.lineNet} fill="none" stroke="var(--a-fg)" strokeWidth="1.6" strokeDasharray="3 3" />
      {d.monthLabels.map((m) => (
        <text key={m.text} className="ax" x={m.x} y={height + 2}>
          {m.text}
        </text>
      ))}
    </svg>
  );
}

/** Due linee a confronto (tu e indice), con la linea dell'indice più sottile e grigia. */
export function ComparisonChart({ width, height, seed }: { width: number; height: number; seed: number }) {
  const d = comparisonLines(width, height, seed);
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path className="dr" pathLength={1} d={d.index} fill="none" stroke="var(--a-t3)" strokeWidth="1.6" />
      <path className="dr" pathLength={1} d={d.you} fill="none" stroke="var(--a-primary)" strokeWidth="2.4" />
    </svg>
  );
}

/** Residuo di un debito che scende a gradini. */
export function DebtStepsChart({ width, height }: { width: number; height: number }) {
  const d = debtStepsPath(width, height);
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d.area} fill="var(--a-neg)" opacity=".1" />
      <path className="dr" pathLength={1} d={d.line} fill="none" stroke="var(--a-neg)" strokeWidth="2" />
    </svg>
  );
}
