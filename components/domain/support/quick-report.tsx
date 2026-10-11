"use client";

/** Segnalazione rapida: un foglio con il form «Scrivici» apribile da qualsiasi punto dell'app (pulsante fisso o messaggio d'errore). */

import * as React from "react";
import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReportKind } from "@/lib/support";
import { ReportForm } from "./report-form";
import { useReportContext } from "./use-report-context";

/** Cosa è andato storto, quando il foglio si apre da un errore: area e messaggio mostrati all'utente. */
export interface ReportSubject {
  area: string;
  error: string;
}

export interface OpenReportOptions {
  kind?: ReportKind;
  subject?: ReportSubject;
}

const QuickReportContext = React.createContext<((options?: OpenReportOptions) => void) | null>(null);

/** Apre il foglio di segnalazione; fuori dal provider non fa nulla. */
export function useQuickReport(): (options?: OpenReportOptions) => void {
  return React.useContext(QuickReportContext) ?? (() => {});
}

export function QuickReportProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<OpenReportOptions | null>(null);
  const open = React.useCallback((options: OpenReportOptions = {}) => setState(options), []);
  return (
    <QuickReportContext.Provider value={open}>
      {children}
      <QuickReportDialog options={state} onClose={() => setState(null)} />
    </QuickReportContext.Provider>
  );
}

function QuickReportDialog({ options, onClose }: { options: OpenReportOptions | null; onClose: () => void }) {
  const pathname = usePathname();
  const context = useReportContext(pathname);
  const subject = options?.subject;
  return (
    <Dialog open={options !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">{subject ? "Segnala questo problema" : "Scrivici"}</DialogTitle>
          <DialogDescription>Ti rispondiamo via email. Leggiamo tutto.</DialogDescription>
        </DialogHeader>
        {subject ? (
          <div className="flex items-start gap-2 rounded-lg bg-neg-soft p-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-neg" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{subject.area}</p>
              <p className="text-muted-foreground">{subject.error}</p>
            </div>
          </div>
        ) : null}
        <ReportForm key={JSON.stringify(options)} context={context} initialKind={options?.kind ?? "problema"} compact hideKind={Boolean(subject)} />
      </DialogContent>
    </Dialog>
  );
}

/** Link «Segnala questo problema» da mettere sotto un messaggio d'errore: apre il foglio con l'errore già allegato. */
export function ReportErrorLink({ area, error, className }: ReportSubject & { className?: string }) {
  const openReport = useQuickReport();
  return (
    <button
      type="button"
      onClick={() => openReport({ kind: "problema", subject: { area, error } })}
      className={className ?? "inline-flex min-h-9 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"}
    >
      Segnala questo problema
    </button>
  );
}
