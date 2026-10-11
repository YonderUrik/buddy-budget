/** Costanti del canale di supporto: tipi di segnalazione, limiti e indirizzi. Nessuna dipendenza, usabile anche dal client. */

export const REPORT_KINDS = ["problema", "domanda", "idea"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  problema: "Un problema",
  domanda: "Una domanda",
  idea: "Un'idea",
};

export const REPORT_MESSAGE_MIN_LENGTH = 10;
export const REPORT_MESSAGE_MAX_LENGTH = 4000;
/** Segnalazioni ammesse per utente nella finestra `REPORT_RATE_WINDOW_SECONDS`. */
export const REPORT_RATE_LIMIT = 5;
export const REPORT_RATE_WINDOW_SECONDS = 60 * 60;

/** Casella che riceve le segnalazioni; sovrascrivibile lato server con `SUPPORT_EMAIL_TO`. */
export const SUPPORT_EMAIL = "supporto@buddybudget.io";

/** Repository open source dell'app: issue, release e policy di sicurezza. */
export const REPO_URL = "https://github.com/YonderUrik/buddy-budget";
