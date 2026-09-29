/**
 * Composizione del portafoglio: una barra segmentata per dimensione (tipo di strumento, valuta) con legenda e una
 * frase che ne dice il senso (es. quanto sei esposto a valute diverse dalla tua).
 */

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompositionSlice } from "@/lib/calc/investments";
import { formatCurrency } from "@/lib/format";

export interface CompositionGroup {
  title: string;
  slices: CompositionSlice[];
  /** Colore di una fetta (CSS, es. `var(--swatch-blue)`). */
  colorFor: (key: string, index: number) => string;
  /** Etichetta leggibile di una fetta (es. "etf" → "ETF"). */
  labelFor?: (key: string) => string;
  /** Lettura della dimensione in una frase. */
  insight?: string | null;
}

export interface PortfolioCompositionProps {
  groups: CompositionGroup[];
  currency: string;
  /** Titolo della card (default "Composizione"). */
  title?: string;
  /** Riga sotto il titolo. */
  subtitle?: string | null;
  /** Contenuto sotto le barre (es. da dove vengono i dati). */
  children?: ReactNode;
}

function formatShare(share: number): string {
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0).replace(".", ",")}%`;
}

export function PortfolioComposition({ groups, currency, title = "Composizione", subtitle = null, children }: PortfolioCompositionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title} className="flex flex-col gap-3" aria-label={group.title}>
              <div>
                <p className="text-sm font-medium text-foreground">{group.title}</p>
                {group.insight ? <p className="text-sm text-muted-foreground">{group.insight}</p> : null}
              </div>
              {group.slices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun valore da mostrare.</p>
              ) : (
                <>
                  <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                    {group.slices.map((slice, i) => (
                      <div key={slice.key} className="h-full" style={{ flexGrow: slice.share, backgroundColor: group.colorFor(slice.key, i) }} />
                    ))}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {group.slices.map((slice, i) => (
                      <li key={slice.key} className="flex items-center gap-2 text-sm">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.colorFor(slice.key, i) }} aria-hidden="true" />
                        <span className="flex-1 text-foreground">{group.labelFor?.(slice.key) ?? slice.key}</span>
                        <span className="tabular-nums text-muted-foreground">{formatCurrency(slice.value, currency, { maximumFractionDigits: 0 })}</span>
                        <span className="w-12 text-right font-medium tabular-nums text-foreground">{formatShare(slice.share)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
