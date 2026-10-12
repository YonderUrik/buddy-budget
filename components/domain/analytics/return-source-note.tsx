"use client";

/** Riga sotto il cursore del rendimento: da dove viene il valore, il ritorno allo storico e l'avviso se è molto alto. */

import { TriangleAlert } from "lucide-react";
import type { ExpectedReturnInfo } from "@/lib/analitiche/historical-return";
import type { DataPeriod } from "@/lib/analitiche/period";
import { pct } from "./analytics-format";
import { HIGH_RETURN_TEXT, HIGH_RETURN_WARNING, historyOffer, returnSourceText } from "./return-source";

export interface ReturnSourceNoteProps {
  info: ExpectedReturnInfo;
  /** Valore mostrato dal cursore (anche se non ancora salvato), per l'avviso. */
  value: number;
  currency: string;
  /** Periodo dei dati, per dire su quali mesi è calcolato il rendimento. */
  period: DataPeriod;
  saving: boolean;
  onUseHistory: () => void;
}

export function ReturnSourceNote({ info, value, currency, period, saving, onUseHistory }: ReturnSourceNoteProps) {
  const offer = historyOffer(info);
  return (
    <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
      <p>
        {returnSourceText(info, currency, period)}
        {offer !== null ? (
          <>
            {" "}
            <button type="button" className="font-medium text-foreground underline underline-offset-2 disabled:opacity-50" onClick={onUseHistory} disabled={saving}>
              Usa il tuo rendimento ({pct(offer)})
            </button>
          </>
        ) : null}
      </p>
      {value > HIGH_RETURN_WARNING ? (
        <p className="flex gap-1.5 text-risk-3" role="note">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{HIGH_RETURN_TEXT}</span>
        </p>
      ) : null}
    </div>
  );
}
