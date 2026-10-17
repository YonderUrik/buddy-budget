/**
 * Apertura del foglio di segnalazione da codice non React (es. l'azione di un toast): passa per un evento del browser
 * che `QuickReportProvider` ascolta. Senza provider montato non fa nulla.
 */

import { toast } from "sonner";
import { pageText } from "@/lib/localization/page-text";
import type { ReportErrorArea } from "./constants";
import type { ReportError } from "./report";

export const REPORT_OPEN_EVENT = "buddybudget:segnala";

export interface OpenReportOptions {
  /** `pulsante` per il pulsante fisso, `errore` quando si allega un errore. */
  source: "pulsante" | "errore";
  error?: ReportError;
}

export function requestReport(options: OpenReportOptions): void {
  window.dispatchEvent(new CustomEvent<OpenReportOptions>(REPORT_OPEN_EVENT, { detail: options }));
}

/** Error toast with the «Segnala» action, which opens the report sheet with the error attached; labelled in the page language. */
export function errorToast(message: string, area: ReportErrorArea = "salvataggio"): void {
  toast.error(pageText(message), { action: { label: pageText("Segnala"), onClick: () => requestReport({ source: "errore", error: { area, message } }) } });
}
