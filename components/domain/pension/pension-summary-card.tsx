/**
 * Card principale di Pensione: controvalore del fondo, quanto è dato dai contributi e quanto dal rendimento, con il
 * rendimento annuo ponderato per i tempi (non "valore meno versato", che con versamenti a rate è fuorviante).
 */

import { Card, CardContent } from "@/components/ui/card";
import type { PensionPerformance } from "@/lib/calc/pension";
import { InfoHint } from "@/components/domain/shared";
import { formatLongDateKey, formatSignedPercent, money } from "./pension-format";

export interface PensionSummaryCardProps {
  name: string;
  performance: PensionPerformance;
  currency: string;
}

const ANNUAL_RETURN_HINT =
  "Rendimento annuo che tiene conto di quando hai versato: un euro versato il mese scorso non ha avuto il tempo di rendere. Se manca lo storico dei primi anni è una stima.";

export function PensionSummaryCard({ name, performance, currency }: PensionSummaryCardProps) {
  const { value, netContributions, gain, gainPct, annualReturn, approximate, lastDate } = performance;
  const contributionShare = value > 0 ? Math.min(1, netContributions / value) : 1;
  const stats = [
    { label: "Contributi netti", value: money(netContributions, currency) },
    { label: gain >= 0 ? "Guadagno" : "Perdita", value: `${gain >= 0 ? "+" : "−"}${money(Math.abs(gain), currency)}`, tone: gain >= 0 ? "text-pos" : "text-neg" },
    { label: "Sui contributi", value: gainPct !== null ? formatSignedPercent(gainPct) : "—", tone: gain >= 0 ? "text-pos" : "text-neg" },
  ];
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{name}</p>
          <p className="font-heading text-4xl font-medium tabular-nums text-foreground">{money(value, currency)}</p>
          <p className="text-sm text-muted-foreground">Controvalore al {formatLongDateKey(lastDate)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Contributi netti ${money(netContributions, currency)} su ${money(value, currency)}`}>
            <span className="h-full bg-primary" style={{ width: `${contributionShare * 100}%` }} />
            {gain > 0 ? <span className="h-full bg-pos" style={{ width: `${(1 - contributionShare) * 100}%` }} /> : null}
          </div>
          <p className="text-sm text-foreground">
            {gain >= 0 ? (
              <>
                Hai versato <strong className="font-medium tabular-nums">{money(netContributions, currency)}</strong>, il resto (
                <strong className="font-medium tabular-nums text-pos">{money(gain, currency)}</strong>) l&apos;ha prodotto il fondo.
              </>
            ) : (
              <>
                Hai versato <strong className="font-medium tabular-nums">{money(netContributions, currency)}</strong>: oggi il fondo ne vale meno.
              </>
            )}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-muted/50 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className={`font-heading text-lg font-medium tabular-nums ${stat.tone ?? "text-foreground"}`}>{stat.value}</dd>
            </div>
          ))}
          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              Rendimento annuo{approximate ? " (stima)" : ""} <InfoHint label="Come si calcola il rendimento annuo">{ANNUAL_RETURN_HINT}</InfoHint>
            </dt>
            <dd className="font-heading text-lg font-medium tabular-nums text-foreground">{annualReturn !== null ? formatSignedPercent(annualReturn) : "—"}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
