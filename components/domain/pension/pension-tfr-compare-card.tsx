"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Confronto tra il fondo e il TFR lasciato in azienda, a parità di versamenti: due barre e il tasso annuo di ciascuno. */

import { ScaleIcon } from "lucide-react";
import type { CompanyTfrComparison } from "@/lib/calc/pension";
import { formatPercent, formatSignedPercent, money } from "./pension-format";
import { PensionSection } from "./pension-section";

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
  const { t: tr } = useLocalization();
  const diff = fundValue - comparison.net;
  const diffPct = comparison.net > 0 ? diff / comparison.net : null;
  const better = diff >= 0;
  const top = Math.max(fundValue, comparison.net, 1);
  const rows = [
    { key: "fund", label: tr("Nel fondo"), value: fundValue, rate: fundAnnualReturn, bar: "bg-primary" },
    { key: "company", label: tr("In azienda, rivalutato"), value: comparison.net, rate: comparison.annualRate, bar: "bg-muted-foreground/50" },
  ];
  return (
    <PensionSection
      icon={ScaleIcon}
      title={tr("Fondo o TFR in azienda?")}
      color="var(--swatch-blue)"
      description={tr("Gli stessi versamenti, in due posti diversi.")}
      hint={{ label: tr("Come funziona il confronto"), text: HINT }}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <div key={row.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-foreground">{tr(row.label)}</span>
                <span className="font-heading text-xl font-medium tabular-nums text-foreground">{money(row.value, currency)}</span>
              </div>
              <div className="h-3.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                <span className={`block h-full rounded-full ${row.bar} motion-safe:transition-[width] motion-safe:duration-700`} style={{ width: `${(row.value / top) * 100}%` }} />
              </div>
              <p className="text-sm text-text-2">{row.rate !== null ? tr("{0} l'anno", {0: formatPercent(row.rate)}) : tr("rendimento non calcolabile")}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-text-2">
          {better ? tr("Finora il fondo ha reso") : tr("Finora il TFR in azienda avrebbe reso")}{" "}
          <strong className={`font-semibold tabular-nums ${better ? "text-pos" : "text-neg"}`}>{money(Math.abs(diff), currency)}</strong>
          {diffPct !== null ? <> ({formatSignedPercent(Math.abs(diffPct))})</> : null}{" "}{tr("in più. Rivalutazione in azienda stimata al")}{" "}{formatPercent(comparison.annualRate)}{" "}{tr("l'anno con inflazione ipotizzata al")}{" "}{formatPercent(inflationRate)}{tr(": il confronto ha senso solo su periodi lunghi, perché il fondo oscilla.")}</p>
      </div>
    </PensionSection>
  );
}
