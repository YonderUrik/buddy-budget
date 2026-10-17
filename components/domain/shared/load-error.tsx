"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Riquadro di errore di caricamento con bottone "Riprova", condiviso dalle pagine dell'app. */

import { Button } from "@/components/ui/button";
import { ReportErrorLink } from "@/components/domain/support";
import type { ReportErrorArea } from "@/lib/support";

export interface LoadErrorProps {
  /** Messaggio che nomina cosa non è stato caricato (es. "Impossibile caricare i conti."). */
  message: string;
  onRetry: () => void;
  /** Operazione da allegare se l'utente segnala l'errore. Default: caricamento della pagina. */
  reportArea?: ReportErrorArea;
}

export function LoadError({ message, onRetry, reportArea = "caricamento" }: LoadErrorProps) {
  const { t: tr } = useLocalization();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
    >
      <span>{tr(message)}</span>
      <div className="flex items-center gap-3">
        <ReportErrorLink area={reportArea} error={message} />
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>{tr("Riprova")}</Button>
      </div>
    </div>
  );
}
