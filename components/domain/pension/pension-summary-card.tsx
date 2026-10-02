/**
 * Card principale di Pensione: l'anello di cosa è fatto il fondo e, a fianco, versato, guadagno e rendimento annuo
 * ponderato per i tempi (non "valore meno versato", che con versamenti a rate è fuorviante).
 */

import { Card, CardContent } from "@/components/ui/card";
import { InfoHint } from "@/components/domain/shared";
import type { PensionPerformance } from "@/lib/calc/pension";
import { formatLongDateKey, formatSignedPercent, money } from "./pension-format";
import { PensionRing } from "./pension-ring";

export interface PensionSummaryCardProps {
  name: string;
  performance: PensionPerformance;
  currency: string;
}

const ANNUAL_RETURN_HINT =
  "Rendimento annuo che tiene conto di quando hai versato: un euro versato il mese scorso non ha avuto il tempo di rendere. Se manca lo storico dei primi anni è una stima.";

export function PensionSummaryCard({ name, performance, currency }: PensionSummaryCardProps) {
  const { value, netContributions, gain, gainPct, annualReturn, approximate, lastDate } = performance;
  const tone = gain >= 0 ? "text-pos" : "text-neg";
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <PensionRing value={value} netContributions={netContributions} currency={currency} />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{name}</p>
            <p className="text-sm text-muted-foreground">Aggiornato al {formatLongDateKey(lastDate)}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-primary" aria-hidden="true" />Versato</dt>
              <dd className="font-heading text-xl font-medium tabular-nums text-foreground">{money(netContributions, currency)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`size-2 rounded-full ${gain >= 0 ? "bg-pos" : "bg-neg"}`} aria-hidden="true" />{gain >= 0 ? "Guadagno" : "Perdita"}</dt>
              <dd className={`font-heading text-xl font-medium tabular-nums ${tone}`}>{gain >= 0 ? "+" : "−"}{money(Math.abs(gain), currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sui contributi</dt>
              <dd className={`font-heading text-xl font-medium tabular-nums ${tone}`}>{gainPct !== null ? formatSignedPercent(gainPct) : "—"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">Rendimento annuo{approximate ? " (stima)" : ""} <InfoHint label="Come si calcola il rendimento annuo">{ANNUAL_RETURN_HINT}</InfoHint></dt>
              <dd className="font-heading text-xl font-medium tabular-nums text-foreground">{annualReturn !== null ? formatSignedPercent(annualReturn) : "—"}</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
