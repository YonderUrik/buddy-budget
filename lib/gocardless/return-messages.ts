import type { NativeReturnStatus } from "./redirect";

/** `bankError` values the web callback puts on `/liquidita/conti` when the consent step fails. */
export const WEB_BANK_ERRORS = ["missing_ref", "not_found", "consent_failed", "gocardless_unavailable"] as const;
export type WebBankError = (typeof WEB_BANK_ERRORS)[number];

/** Italian source of the message the web shows for each `bankError` (translated with `t`). */
export const WEB_BANK_ERROR_MESSAGES: Record<WebBankError, string> = {
  missing_ref: "Non abbiamo trovato il collegamento con la banca. Riprova dall'inizio.",
  not_found: "Non abbiamo trovato il collegamento con la banca. Riprova dall'inizio.",
  consent_failed: "La banca non ha confermato il consenso: il collegamento non è stato completato.",
  gocardless_unavailable: "Il servizio di collegamento bancario non risponde. Riprova tra poco.",
};

/** The web error message for a `bankError` query value, or null when the value is missing or unknown. */
export function webBankErrorMessage(value: string | null | undefined): string | null {
  return value && (WEB_BANK_ERRORS as readonly string[]).includes(value) ? WEB_BANK_ERROR_MESSAGES[value as WebBankError] : null;
}

/** Italian source of the fallback page's sentence for each native return outcome (`/banca/ritorno`). */
export const NATIVE_RETURN_MESSAGES: Record<NativeReturnStatus, string> = {
  returned: "Hai finito con la banca. Torna nell'app per scegliere i conti da collegare.",
  cancelled: "Hai annullato il collegamento con la banca. Puoi riprovare dall'app.",
  failed: "La banca non ha completato il collegamento. Puoi riprovare dall'app.",
  invalid_ref: "Questo collegamento non è valido. Riprova dall'app.",
};
