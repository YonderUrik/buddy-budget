/** Costanti di autenticazione condivise tra server (config better-auth, email) e client (copy della UI). */

/** Durata di validità del magic link, in minuti. */
export const MAGIC_LINK_EXPIRES_MINUTES = 10;

/** Attesa minima prima di poter richiedere un nuovo magic link dalla UI, in secondi. */
export const MAGIC_LINK_RESEND_COOLDOWN_SECONDS = 30;

/**
 * Rotta di atterraggio dopo login/onboarding quando non c'è una destinazione richiesta: la home, che rimanda
 * alla pagina iniziale scelta dall'utente in Impostazioni.
 */
export const DEFAULT_AFTER_LOGIN_PATH = "/";

/**
 * Restituisce `candidate` solo se è un percorso interno sicuro ("/qualcosa", non "//host" né URL assoluto),
 * altrimenti `DEFAULT_AFTER_LOGIN_PATH`. Evita open redirect tramite il parametro `redirect`.
 */
export function safeRedirectPath(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN_PATH;
  }
  if (candidate === "/" || candidate.startsWith("/login") || candidate.startsWith("/onboarding")) {
    return DEFAULT_AFTER_LOGIN_PATH;
  }
  return candidate;
}

/** Durata di una sessione senza utilizzo, in giorni: oltre, si deve accedere di nuovo. */
export const SESSION_EXPIRES_IN_DAYS = 7;

/** Ogni quanti giorni di utilizzo la scadenza della sessione viene spostata in avanti. */
export const SESSION_UPDATE_AGE_DAYS = 1;
