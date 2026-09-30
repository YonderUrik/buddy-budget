/**
 * Barre verticali per mese, ognuna fatta di due parti impilate (es. netto + ritenute = lordo). Etichetta sotto ogni
 * barra; il valore esatto è nel `title` e nell'elenco accessibile.
 */

import { cn } from "@/lib/utils";

export interface MonthBar {
  key: string;
  label: string;
  /** Parte principale (in basso). */
  primary: number;
  /** Parte sopra (es. ritenute); 0 se non serve. */
  secondary: number;
  /** Testo del tooltip nativo. */
  title: string;
}

export interface MonthBarsProps {
  bars: MonthBar[];
  ariaLabel: string;
  /** Classe colore della parte principale e di quella sopra. */
  primaryClassName?: string;
  secondaryClassName?: string;
  /** Altezza in pixel del grafico. */
  height?: number;
}

export function MonthBars({ bars, ariaLabel, primaryClassName = "bg-pos", secondaryClassName = "bg-muted-foreground/30", height = 112 }: MonthBarsProps) {
  const max = Math.max(...bars.map((b) => b.primary + b.secondary), 0);
  return (
    <ul className="grid items-end gap-1" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }} aria-label={ariaLabel}>
      {bars.map((bar) => {
        const total = bar.primary + bar.secondary;
        const barHeight = max > 0 ? Math.max((total / max) * height, total > 0 ? 3 : 0) : 0;
        return (
          <li key={bar.key} className="flex flex-col items-center gap-1" title={bar.title}>
            <span className="sr-only">{bar.title}</span>
            <span className="flex w-full max-w-8 flex-col justify-end overflow-hidden rounded-sm" style={{ height }} aria-hidden="true">
              <span className="flex w-full flex-col" style={{ height: barHeight }}>
                <span className={cn("w-full", secondaryClassName)} style={{ flexGrow: bar.secondary }} />
                <span className={cn("w-full", primaryClassName)} style={{ flexGrow: bar.primary }} />
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground" aria-hidden="true">
              {bar.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
