"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Riga breve sotto il cursore del rendimento: da dove viene (dettagli nel tasto info), ritorno allo storico e avviso se è alto. */

import { TriangleAlert } from "lucide-react";
import { InfoHint } from "@/components/domain/shared";
import type { ExpectedReturnInfo } from "@/lib/analitiche/historical-return";
import type { DataPeriod } from "@/lib/analitiche/period";
import { localizedAnalyticsFormats } from "./analytics-format";
import { localizedReturnSource, HIGH_RETURN_WARNING } from "./return-source";

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
  const { HIGH_RETURN_TEXT, historyOffer, returnSourceLabel, returnSourceText } = localizedReturnSource(useLocalization().language);

  const { pct } = localizedAnalyticsFormats(useLocalization().language);

  const { t: tr } = useLocalization();
  const offer = historyOffer(info);
  const detail = info.source === "manuale" ? null : returnSourceText(info, currency, period);
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <p className="flex flex-wrap items-center gap-x-1.5">
        <span className="flex items-center gap-0.5">
          {tr(returnSourceLabel(info))}
          {detail ? <InfoHint label={tr("Da dove viene il rendimento")}>{detail}</InfoHint> : null}
        </span>
        {offer !== null ? (
          <button type="button" className="font-medium text-foreground underline underline-offset-2 disabled:opacity-50" onClick={onUseHistory} disabled={saving}>{tr("Usa il tuo (")}{pct(offer)}{")"}</button>
        ) : null}
      </p>
      {value > HIGH_RETURN_WARNING ? (
        <p className="flex items-center gap-1 text-risk-3" role="note">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />{tr("Stima ottimistica")}<InfoHint label={tr("Perché è ottimistica")}>{HIGH_RETURN_TEXT}</InfoHint>
        </p>
      ) : null}
    </div>
  );
}
