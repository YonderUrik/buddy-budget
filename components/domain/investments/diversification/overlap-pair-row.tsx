/** Riga di una coppia di fondi che si sovrappongono: disegno, giudizio in parole, nomi e perché lo diciamo. */

import type { FundOverlap, OverlapMethod } from "@/lib/investments/overlap";
import { overlapLabel } from "@/lib/investments/plain-labels";
import { OverlapVenn } from "./overlap-venn";

const METHOD_NOTE: Record<OverlapMethod, string> = {
  stesso_indice: "Replicano lo stesso indice.",
  aree_indici: "Stima dagli indici che replicano.",
  primi_titoli: "Almeno così: contando solo i primi 10 titoli.",
};

export interface OverlapPairRowProps {
  overlap: FundOverlap;
  nameOf: (id: string) => string;
}

export function OverlapPairRow({ overlap, nameOf }: OverlapPairRowProps) {
  const verdict = overlapLabel(overlap.share);
  return (
    <li className="flex items-start gap-3 rounded-xl border p-3">
      <OverlapVenn share={overlap.share} severity={verdict.severity} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {verdict.label} <span className="tabular-nums text-muted-foreground">· {Math.round(overlap.share * 100)}% in comune</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {nameOf(overlap.aId)} <span aria-hidden="true">+</span>
          <span className="sr-only">e</span> {nameOf(overlap.bId)}
        </p>
        <p className="text-xs text-muted-foreground">{METHOD_NOTE[overlap.method]}</p>
      </div>
    </li>
  );
}
