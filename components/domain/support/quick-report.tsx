"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Segnalazione rapida: un foglio con il form «Scrivici» apribile da qualsiasi punto dell'app, dal pulsante fisso
 * (sidebar e barra in alto su telefono) o dal link «Segnala questo problema» sotto un errore, che allega l'errore.
 * Si apre anche fuori da React (es. dall'azione di un toast) con `requestReport` di `lib/support`.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import { REPORT_ERROR_AREA_LABELS, REPORT_ERROR_MAX_LENGTH, type ReportErrorArea } from "@/lib/support";
import { REPORT_OPEN_EVENT, requestReport, type OpenReportOptions } from "@/lib/support/request-report";
import { ReportForm } from "./report-form";
import { useReportContext } from "./use-report-context";

const QuickReportContext = React.createContext<((options: OpenReportOptions) => void) | null>(null);

/** Apre il foglio di segnalazione; fuori dal provider usa `requestReport`. */
export function useQuickReport(): (options: OpenReportOptions) => void {
  return React.useContext(QuickReportContext) ?? requestReport;
}

/** Monta il foglio «Scrivici» una volta sola per tutta l'app (nel layout autenticato). */
export function QuickReportProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<OpenReportOptions | null>(null);
  const open = React.useCallback((options: OpenReportOptions) => {
    const error = options.error ? { ...options.error, message: options.error.message.slice(0, REPORT_ERROR_MAX_LENGTH) } : undefined;
    setState({ ...options, error });
    track("support_sheet_opened", { source: options.source, area: error?.area });
  }, []);
  React.useEffect(() => {
    const onRequest = (event: Event) => open((event as CustomEvent<OpenReportOptions>).detail);
    window.addEventListener(REPORT_OPEN_EVENT, onRequest);
    return () => window.removeEventListener(REPORT_OPEN_EVENT, onRequest);
  }, [open]);
  return (
    <QuickReportContext.Provider value={open}>
      {children}
      <QuickReportDialog options={state} onClose={() => setState(null)} />
    </QuickReportContext.Provider>
  );
}

function QuickReportDialog({ options, onClose }: { options: OpenReportOptions | null; onClose: () => void }) {
  const { t: tr } = useLocalization();
  const pathname = usePathname();
  const context = useReportContext(pathname);
  // Il contenuto resta durante l'animazione di chiusura.
  const [shown, setShown] = React.useState(options);
  if (options && options !== shown) setShown(options);
  const error = shown?.error;
  return (
    <Dialog open={options !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">{error ? tr("Segnala questo problema") : tr("Scrivici")}</DialogTitle>
          <DialogDescription>{tr("Ti rispondiamo via email. Leggiamo tutto.")}</DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="flex items-start gap-2 rounded-lg bg-neg-soft p-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-neg" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{tr(REPORT_ERROR_AREA_LABELS[error.area])}</p>
              <p className="break-words text-muted-foreground">{tr(error.message)}</p>
            </div>
          </div>
        ) : null}
        {shown ? <ReportForm key={JSON.stringify(shown)} context={context} compact source={shown.source} error={error} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export interface ReportErrorLinkProps {
  area: ReportErrorArea;
  /** Messaggio d'errore mostrato all'utente: viaggia con la segnalazione (mai dati finanziari nei nostri messaggi). */
  error: string;
  className?: string;
}

/** Link «Segnala questo problema» da mettere sotto un messaggio d'errore: apre il foglio con l'errore già allegato. */
export function ReportErrorLink({ area, error, className }: ReportErrorLinkProps) {
  const { t: tr } = useLocalization();
  const openReport = useQuickReport();
  return (
    <button
      type="button"
      onClick={() => openReport({ source: "errore", error: { area, message: error } })}
      className={className ?? "inline-flex min-h-9 w-fit items-center text-sm font-medium text-primary underline-offset-4 hover:underline"}
    >{tr("Segnala questo problema")}</button>
  );
}

/** Messaggio d'errore di un form con sotto il link per segnalarlo. */
export function ErrorWithReport({ area, error, className }: ReportErrorLinkProps) {
  const { t: tr } = useLocalization();
  return (
    <div className={className ?? "flex flex-col items-start"}>
      <p role="alert" className="text-sm text-destructive">{tr(error)}</p>
      <ReportErrorLink area={area} error={error} />
    </div>
  );
}
