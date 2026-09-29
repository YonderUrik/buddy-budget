/** Costanti della gestione account (impostazioni utente), condivise tra route server e UI. */

/** Giorni tra la disattivazione dell'account e la sua eliminazione definitiva (rientrando prima si annulla). */
export const DEACTIVATION_GRACE_DAYS = 30;

/**
 * Età massima della sessione, in minuti, per le azioni sensibili (export, reset, disattivazione, eliminazione).
 * Oltre questa soglia si chiede di accedere di nuovo: un portatile lasciato aperto non basta.
 */
export const RECENT_LOGIN_MAX_AGE_MINUTES = 10;

/** Parola da scrivere per confermare il reset di tutti i dati. */
export const RESET_CONFIRMATION_WORD = "RESETTA";

/** Codice d'errore delle route quando serve un accesso recente (la UI mostra il pannello di verifica). */
export const REAUTH_REQUIRED_CODE = "reauth_required";

/** Lunghezza massima del nome visualizzato. */
export const DISPLAY_NAME_MAX_LENGTH = 80;

/** Parametro di query che la pagina di login legge per dire che l'account è stato eliminato. */
export const ACCOUNT_DELETED_QUERY = "account=eliminato";
