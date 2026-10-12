"use client";

/** Riga sotto i cursori di risparmio e spesa: se la cifra viene dai movimenti o è scritta a mano, con il ritorno ai dati. */

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
    const average = coveredMonths < periodMonths ? `media dei ${coveredMonths} mesi da quando registri i movimenti` : `media dei movimenti ${periodPhrase}`;
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Dai tuoi dati:</span> {average}, su base annua.
      </p>
    );
  }
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">Inserito a mano.</span>
      {dataValue !== null ? (
        <>
          {" "}
          <button type="button" className="font-medium text-foreground underline underline-offset-2 disabled:opacity-50" onClick={onUseData} disabled={saving}>
            Usa i tuoi dati ({money(dataValue, currency)})
          </button>
        </>
      ) : null}
    </p>
  );
}
