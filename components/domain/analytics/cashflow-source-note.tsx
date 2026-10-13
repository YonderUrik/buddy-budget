"use client";

/** Riga breve sotto i cursori di risparmio e spesa: «Dai tuoi dati» o «A mano», con i dettagli nel tasto info. */

import { InfoHint } from "@/components/domain/shared";
import type { FigureSource } from "@/lib/analitiche/plan";
import { money } from "./analytics-format";

export interface CashflowSourceNoteProps {
  source: FigureSource;
  /** Cifra ricavata dai movimenti (anche quando l'utente ne ha scritta un'altra), null se i mesi sono troppo pochi. */
  dataValue: number | null;
  /** «negli ultimi 12 mesi» o «da gen 2024 a dic 2025». */
  periodPhrase: string;
  /** Mesi su cui si fa la media e mesi del periodo: se i primi sono meno, i movimenti iniziano dopo. */
  coveredMonths: number;
  periodMonths: number;
  currency: string;
  saving: boolean;
  onUseData: () => void;
}

export function CashflowSourceNote({ source, dataValue, periodPhrase, coveredMonths, periodMonths, currency, saving, onUseData }: CashflowSourceNoteProps) {
  if (source === "manca") return null;
  if (source === "dati") {
    const average = coveredMonths < periodMonths ? `dei ${coveredMonths} mesi da quando registri i movimenti` : `dei movimenti ${periodPhrase}`;
    return (
      <p className="flex items-center gap-0.5 text-xs text-muted-foreground">
        Dai tuoi dati
        <InfoHint label="Da dove viene questa cifra">Media mensile {average}, moltiplicata per 12. I giroconti tra i tuoi conti non contano.</InfoHint>
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      Scritta a mano
      {dataValue !== null ? (
        <button type="button" className="font-medium text-foreground underline underline-offset-2 disabled:opacity-50" onClick={onUseData} disabled={saving}>
          Usa i tuoi dati ({money(dataValue, currency)})
        </button>
      ) : null}
    </p>
  );
}
