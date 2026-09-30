/** Card "La tua posizione" sul titolo: quote, prezzo medio, valore e variazione dell'ultima chiusura rispetto al prezzo medio. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TitlePosition } from "@/lib/investments/title-view";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "../gain-text";
import { formatPrice } from "./title-format";

const QUANTITY_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 });

export interface TitlePositionCardProps {
  position: TitlePosition;
  currency: string;
  /** Testo dell'azione secondaria (es. "Registra un'operazione"). */
  action?: React.ReactNode;
}

export function TitlePositionCard({ position, currency, action }: TitlePositionCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">La tua posizione</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Quote</dt>
            <dd className="text-base font-medium tabular-nums text-foreground">{QUANTITY_FORMAT.format(position.quantity)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prezzo medio</dt>
            <dd className="text-base font-medium tabular-nums text-foreground">
              {position.averagePrice !== null ? formatPrice(position.averagePrice, currency) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Valore</dt>
            <dd className="text-base font-medium tabular-nums text-foreground">{formatPrice(position.value, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Rispetto al prezzo medio</dt>
            <dd
              className={cn(
                "text-base font-medium tabular-nums",
                position.changeVsAverage === null ? "text-foreground" : position.changeVsAverage < 0 ? "text-neg" : "text-pos"
              )}
            >
              {position.changeVsAverage !== null ? formatSignedPct(position.changeVsAverage) : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Valori nella valuta del titolo ({currency}), senza cambio né tasse. Il guadagno completo è nelle schede Portafoglio e Tasse.
        </p>
      </CardContent>
    </Card>
  );
}
