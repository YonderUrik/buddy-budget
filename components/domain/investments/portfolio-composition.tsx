/** Composizione del portafoglio per tipo di strumento e per valuta, come barre orizzontali proporzionali. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompositionSlice } from "@/lib/calc/investments";
import { formatCurrency } from "@/lib/format";

export interface CompositionGroup {
  title: string;
  slices: CompositionSlice[];
  /** Etichetta leggibile di una fetta (es. "etf" → "ETF"). */
  labelFor?: (key: string) => string;
}

export interface PortfolioCompositionProps {
  groups: CompositionGroup[];
  currency: string;
}

function formatShare(share: number): string {
  return `${(share * 100).toFixed(1).replace(".", ",")}%`;
}

export function PortfolioComposition({ groups, currency }: PortfolioCompositionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Composizione</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">{group.title}</p>
            {group.slices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun valore da mostrare.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {group.slices.map((slice) => (
                  <li key={slice.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-foreground">{group.labelFor?.(slice.key) ?? slice.key}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatShare(slice.share)} · {formatCurrency(slice.value, currency, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(slice.share * 100, 1)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
