"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Schermata mostrata quando una pagina dell'app si rompe durante il rendering (error boundary di Next). Manda l'errore
 * al server una volta sola, poi offre «Riprova» e il link per segnalarlo con il codice dell'errore allegato.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ReportErrorLink } from "@/components/domain/support";
import { reportClientError, type ClientErrorKind } from "@/lib/client-errors";
import { PAGE_TITLE } from "./page-title";

const DEFAULT_TITLE = "Questa pagina non si è caricata";
const DEFAULT_DESCRIPTION = "Qualcosa è andato storto da parte nostra. I tuoi dati non sono stati toccati: riprova, e se succede ancora segnalacelo.";
const RETRY_LABEL = "Riprova";

export interface PageErrorProps {
  error: Error & { digest?: string };
  /** Riprova il rendering del segmento (prop `retry` dell'error boundary). */
  onRetry: () => void;
  /** Tipo di boundary, finisce nella metrica: `sezione` per le schermate, `globale` per il layout radice. */
  kind?: ClientErrorKind;
  title?: string;
  description?: string;
  /** Mostra «Segnala questo problema»: serve il provider del foglio di segnalazione (layout autenticato). */
  showReport?: boolean;
}

export function PageError({
  error,
  onRetry,
  kind = "sezione",
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  showReport = true,
}: PageErrorProps) {
  const { t: tr } = useLocalization();
  React.useEffect(() => {
    reportClientError(error, kind);
  }, [error, kind]);

  const reference = error.digest ? tr("Codice errore: {0}", { 0: error.digest }) : null;
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-4 p-4 py-16 sm:p-6 sm:py-24">
      <h1 className={PAGE_TITLE}>{tr(title)}</h1>
      <p className="text-sm text-text-2">{tr(description)}</p>
      {reference ? <code className="block font-mono text-xs text-text-3">{reference}</code> : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={onRetry}>
          {tr(RETRY_LABEL)}
        </Button>
        {showReport ? <ReportErrorLink area="caricamento" error={reference ? `${title}. ${reference}` : title} /> : null}
      </div>
    </div>
  );
}
