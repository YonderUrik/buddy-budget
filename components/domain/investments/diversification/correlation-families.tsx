"use client";
import { useLocalization } from "@/lib/localization/provider";
/**
 * Le posizioni raggruppate in "famiglie" che si muovono insieme (stessa famiglia = poca diversificazione tra loro) e,
 * a parte, quelle che vanno per conto loro: si capisce a colpo d'occhio dove sei davvero diversificato.
 */

import type { CorrelationMatrix as Matrix } from "@/lib/calc/risk";
import type { Instrument } from "@/lib/db/schema/investments";
import { InstrumentLabel } from "../instrument-label";
import { correlationFamilies } from "@/lib/investments/plain-labels";

export interface CorrelationFamiliesProps {
  matrix: Matrix;
  instrumentsById: Map<string, Instrument>;
}

function Chip({ instrument }: { instrument: Instrument | undefined }) {
  return (
    <li className="flex max-w-full items-center rounded-full bg-background py-1 pl-1.5 pr-3 text-sm text-foreground">
      {instrument ? <InstrumentLabel instrument={instrument} /> : "—"}
    </li>
  );
}

export function CorrelationFamilies({ matrix, instrumentsById }: CorrelationFamiliesProps) {
  const { t: tr } = useLocalization();
  const { families, independent } = correlationFamilies(matrix);
  return (
    <div className="flex flex-col gap-3">
      {families.map((family, index) => (
        <div
          key={family.join("-")}
          className="flex flex-col gap-2 rounded-xl bg-[color-mix(in_oklab,var(--swatch-amber)_12%,transparent)] p-3"
        >
          <p className="text-sm font-medium text-foreground">{tr("Famiglia")}{" "}{index + 1}{tr(": si muovono quasi insieme")}<span className="font-normal text-muted-foreground">{" "}{tr("· contano come una sola scommessa")}</span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {family.map((id) => (
              <Chip key={id} instrument={instrumentsById.get(id)} />
            ))}
          </ul>
        </div>
      ))}
      {independent.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
          <p className="text-sm font-medium text-foreground">
            {families.length > 0 ? tr("Vanno per conto loro") : tr("Nessuna coppia si muove insieme")}
            <span className="font-normal text-muted-foreground">{" "}{tr("· diversificano il resto")}</span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {independent.map((id) => (
              <Chip key={id} instrument={instrumentsById.get(id)} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
