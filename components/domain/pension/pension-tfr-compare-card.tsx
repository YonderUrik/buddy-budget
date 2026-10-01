/** Confronto tra il fondo e il TFR lasciato in azienda, a parità di versamenti, con la rivalutazione di legge. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/domain/shared";
import type { CompanyTfrComparison } from "@/lib/calc/pension";
import { formatPercent, formatSignedPercent, money } from "./pension-format";

export interface PensionTfrCompareCardProps {
  fundValue: number;
  comparison: CompanyTfrComparison;
  /** Inflazione annua usata per la rivalutazione del TFR (ipotesi costante). */
  inflationRate: number;
  currency: string;
}

const HINT =
  "In azienda il TFR si rivaluta ogni anno dell'1,5% più il 75% dell'inflazione, con un'imposta sostitutiva sulla rivalutazione. Il confronto usa un'inflazione costante e non include le tasse all'uscita (diverse nei due casi). Regole da validare con un professionista.";

export function PensionTfrCompareCard({ fundValue, comparison, inflationRate, currency }: PensionTfrCompareCardProps) {
  const diff = fundValue - comparison.net;
  const diffPct = comparison.net > 0 ? diff / comparison.net : null;
  const better = diff >= 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fondo o TFR in azienda? <InfoHint label="Come funziona il confronto">{HINT}</InfoHint>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Nel fondo</p>
            <p className="font-heading text-lg font-medium tabular-nums text-foreground">{money(fundValue, currency)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">In azienda, rivalutato</p>
            <p className="font-heading text-lg font-medium tabular-nums text-foreground">{money(comparison.net, currency)}</p>
          </div>
        </div>
        <p className="text-sm text-foreground">
          {better ? "Finora il fondo ha reso" : "Finora il TFR in azienda avrebbe reso"}{" "}
          <strong className={`font-medium tabular-nums ${better ? "text-pos" : "text-neg"}`}>{money(Math.abs(diff), currency)}</strong>
          {diffPct !== null ? <> ({formatSignedPercent(Math.abs(diffPct))})</> : null} {better ? "in più." : "in più del fondo."}
        </p>
        <p className="text-xs text-muted-foreground">
          Rivalutazione in azienda stimata al {formatPercent(comparison.annualRate)} l&apos;anno (inflazione ipotizzata al {formatPercent(inflationRate)}). Il confronto ha senso solo su periodi lunghi: il fondo oscilla.
        </p>
      </CardContent>
    </Card>
  );
}
