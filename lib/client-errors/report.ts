/** Invio di un errore del browser al server. Non lancia mai: se l'invio fallisce l'errore resta solo a schermo. */

import {
  CLIENT_ERROR_DIGEST_MAX,
  CLIENT_ERROR_MESSAGE_MAX,
  CLIENT_ERROR_NAME_MAX,
  clientErrorArea,
  type ClientErrorKind,
  type ClientErrorReport,
} from "./constants";

export const CLIENT_ERRORS_ENDPOINT = "/api/client-errors";

/** Costruisce il corpo da mandare: area dal percorso (mai il percorso intero), testi accorciati. */
export function buildClientErrorReport(
  error: Error & { digest?: string },
  kind: ClientErrorKind,
  pathname: string
): ClientErrorReport {
  return {
    kind,
    area: clientErrorArea(pathname),
    name: error.name ? error.name.slice(0, CLIENT_ERROR_NAME_MAX) : undefined,
    message: (error.message || "Errore senza messaggio").slice(0, CLIENT_ERROR_MESSAGE_MAX),
    digest: error.digest ? error.digest.slice(0, CLIENT_ERROR_DIGEST_MAX) : undefined,
  };
}

/** Manda l'errore al server (keepalive: parte anche se l'utente ricarica subito la pagina). */
export function reportClientError(error: Error & { digest?: string }, kind: ClientErrorKind): void {
  try {
    const body = JSON.stringify(buildClientErrorReport(error, kind, window.location.pathname));
    void fetch(CLIENT_ERRORS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Nessun rumore: la pagina d'errore deve funzionare anche se l'invio non parte.
  }
}
