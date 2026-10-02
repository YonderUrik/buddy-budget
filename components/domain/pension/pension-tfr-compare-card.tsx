/** Confronto tra il fondo e il TFR lasciato in azienda, a parità di versamenti: due barre e il tasso annuo di ciascuno. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/domain/shared";
import type { CompanyTfrComparison } from "@/lib/calc/pension";
import { formatPercent, formatSignedPercent, money } from "./pension-format";

export interface PensionTfrCompareCardProps {
  fundValue: number;
  /** Rendimento annuo del fondo (null se non calcolabile). */
  fundAnnualReturn: number | null;
  comparison: CompanyTfrComparison;
  /** Inflazione annua usata per la rivalutazione del TFR (ipotesi costante). */
  inflationRate: number;
  currency: string;
}

const HINT =
  "In azienda il TFR si rivaluta ogni anno dell'1,5% più il 75% dell'inflazione, con un'imposta sostitutiva sulla rivalutazione. Il confronto usa un'inflazione costante e non include le tasse all'uscita (diverse nei due casi). Regole da validare con un professionista.";

export function PensionTfrCompareCard({ fundValue, fundAnnualReturn, comparison, inflationRate, currency }: PensionTfrCompareCardProps) {
  const diff = fundValue - comparison.net;
  const diffPct = comparison.net > 0 ? diff / comparison.net : null;
  const better = diff >= 0;
  const top = Math.max(fundValue, comparison.net, 1);
  const rows = [
    { key: "fund", label: "Nel fondo", value: fundValue, rate: fundAnnualReturn, bar: "bg-primary" },
    { key: "company", label: "In azienda, rivalutato", value: comparison.net, rate: comparison.annualRate, bar: "bg-muted-foreground/50" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fondo o TFR in azienda? <InfoHint label="Come funziona il confronto">{HINT}</InfoHint>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Gli stessi versamenti, in due posti diversi.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <div key={row.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground">{row.label}</span>
                <span className="font-heading text-lg font-medium tabular-nums text-foreground">{money(row.value, currency)}</span>
              </div>
              <div className="h-3.5 overflow-hidden rounded-full bg-muted">
                <span className={`block h-full rounded-full ${row.bar} motion-safe:transition-[width] motion-safe:duration-700`} style={{ width: `${(row.value / top) * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{row.rate !== null ? `${formatPercent(row.rate)} l'anno` : "rendimento non calcolabile"}</p>
            </div>
          ))}
        </div>
        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-foreground">
          {better ? "Finora il fondo ha reso" : "Finora il TFR in azienda avrebbe reso"}{" "}
          <strong className={`font-medium tabular-nums ${better ? "text-pos" : "text-neg"}`}>{money(Math.abs(diff), currency)}</strong>
          {diffPct !== null ? <> ({formatSignedPercent(Math.abs(diffPct))})</> : null} in più. Rivalutazione in azienda stimata al {formatPercent(comparison.annualRate)} l&apos;anno con inflazione ipotizzata al {formatPercent(inflationRate)}: il confronto ha senso solo su periodi lunghi, perché il fondo oscilla.
        </p>
      </CardContent>
    </Card>
  );
}
