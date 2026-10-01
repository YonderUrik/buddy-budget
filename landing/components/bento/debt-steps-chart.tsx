import { debtStepsPath } from "@/lib/charts";

/** Residuo di un debito che scende a gradini (grafico decorativo del riquadro Debiti). */
export function DebtStepsChart({ width, height }: { width: number; height: number }) {
  const d = debtStepsPath(width, height);
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d.area} fill="var(--a-neg)" opacity=".1" />
      <path className="dr" pathLength={1} d={d.line} fill="none" stroke="var(--a-neg)" strokeWidth="2" />
    </svg>
  );
}
