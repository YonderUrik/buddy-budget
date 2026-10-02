/**
 * Linea del tempo dell'aliquota in uscita: 15% fino a 15 anni dall'adesione, poi scende fino al 9% a 35 anni.
 * Un segnaposto mostra dove sei oggi.
 */

import { exitTaxMilestones, exitTaxRate, wholeYearsBetween } from "@/lib/calc/pension";
import { formatPercent } from "./pension-format";

export interface PensionTaxTimelineProps {
  adhesionDate: string;
  today: string;
}

const TIMELINE_YEARS = 35;
const FLAT_YEARS = 15;

export function PensionTaxTimeline({ adhesionDate, today }: PensionTaxTimelineProps) {
  const milestones = exitTaxMilestones(adhesionDate);
  const years = Math.min(TIMELINE_YEARS, wholeYearsBetween(adhesionDate, today));
  const position = (years / TIMELINE_YEARS) * 100;
  const flatShare = (FLAT_YEARS / TIMELINE_YEARS) * 100;
  const startYear = Number(adhesionDate.slice(0, 4));
  const marks = [
    { left: 0, title: String(startYear), caption: "Adesione" },
    { left: flatShare, title: milestones.reductionStartsOn.slice(0, 4), caption: "Inizia a scendere" },
    { left: 100, title: milestones.minRateOn.slice(0, 4), caption: "Minimo" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative pt-6">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          <span className="h-full bg-neg/70" style={{ width: `${flatShare}%` }} />
          <span className="h-full bg-gradient-to-r from-neg/70 to-pos" style={{ width: `${100 - flatShare}%` }} />
        </div>
        <div className="absolute top-0 -translate-x-1/2" style={{ left: `${position}%` }}>
          <div className="flex flex-col items-center">
            <span className="rounded-md bg-foreground px-1.5 py-0.5 text-xs font-medium tabular-nums text-background">{formatPercent(exitTaxRate(years), 1)}</span>
            <span className="h-3 w-px bg-foreground" aria-hidden="true" />
          </div>
        </div>
      </div>
      <ul className="relative h-9 text-xs text-muted-foreground">
        {marks.map((mark) => (
          <li key={mark.title} className="absolute flex -translate-x-1/2 flex-col items-center whitespace-nowrap first:translate-x-0 first:items-start last:-translate-x-full last:items-end" style={{ left: `${mark.left}%` }}>
            <span className="font-medium tabular-nums text-foreground">{mark.title}</span>
            <span>{mark.caption}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
