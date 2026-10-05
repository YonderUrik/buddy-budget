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
    <li className="flex max-w-full items-center rounded-full border bg-background py-1 pl-1.5 pr-3 text-sm text-foreground">
      {instrument ? <InstrumentLabel instrument={instrument} /> : "—"}
    </li>
  );
}

export function CorrelationFamilies({ matrix, instrumentsById }: CorrelationFamiliesProps) {
  const { families, independent } = correlationFamilies(matrix);
  return (
    <div className="flex flex-col gap-3">
      {families.map((family, index) => (
        <div
          key={family.join("-")}
          className="flex flex-col gap-2 rounded-xl border border-[var(--swatch-amber)]/50 bg-[color-mix(in_oklab,var(--swatch-amber)_8%,transparent)] p-3"
        >
          <p className="text-sm font-medium text-foreground">
            Famiglia {index + 1}: si muovono quasi insieme
            <span className="font-normal text-muted-foreground"> · contano come una sola scommessa</span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {family.map((id) => (
              <Chip key={id} instrument={instrumentsById.get(id)} />
            ))}
          </ul>
        </div>
      ))}
      {independent.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border p-3">
          <p className="text-sm font-medium text-foreground">
            {families.length > 0 ? "Vanno per conto loro" : "Nessuna coppia si muove davvero insieme"}
            <span className="font-normal text-muted-foreground"> · diversificano il resto</span>
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
