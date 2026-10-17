/** Costanti del canale di supporto: tipi di segnalazione, limiti e indirizzi. Nessuna dipendenza, usabile anche dal client. */

export const REPORT_KINDS = ["problema", "domanda", "idea"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  problema: "Un problema",
  domanda: "Una domanda",
  idea: "Un'idea",
};

/** Da dove parte la segnalazione: pagina Aiuto, pulsante «Scrivici» o link sotto un errore. */
export const REPORT_SOURCES = ["pagina", "pulsante", "errore"] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

/** Operazione fallita quando la segnalazione parte da un errore: enum chiuso, finisce in log e Umami. */
export const REPORT_ERROR_AREAS = [
  "import_movimenti",
  "import_investimenti",
  "sync_banca",
  "collega_banca",
  "movimento",
  "operazione",
  "conto",
  "debito",
  "abbonamento",
  "pensione",
  "obiettivo",
  "caricamento",
  "salvataggio",
] as const;
export type ReportErrorArea = (typeof REPORT_ERROR_AREAS)[number];

export const REPORT_ERROR_AREA_LABELS: Record<ReportErrorArea, string> = {
  import_movimenti: "Importazione dei movimenti",
  import_investimenti: "Importazione degli investimenti",
  sync_banca: "Aggiornamento dalla banca",
  collega_banca: "Collegamento della banca",
  movimento: "Salvataggio di un movimento",
  operazione: "Salvataggio di un'operazione",
  conto: "Salvataggio di un conto",
  debito: "Salvataggio di un debito",
  abbonamento: "Salvataggio di un abbonamento",
  pensione: "Salvataggio della pensione",
  obiettivo: "Salvataggio di un obiettivo",
  caricamento: "Caricamento della pagina",
  salvataggio: "Salvataggio",
};

/** Lunghezza massima del messaggio d'errore allegato alla segnalazione. */
export const REPORT_ERROR_MAX_LENGTH = 300;

export const REPORT_MESSAGE_MIN_LENGTH = 10;
export const REPORT_MESSAGE_MAX_LENGTH = 4000;
/** Segnalazioni ammesse per utente nella finestra `REPORT_RATE_WINDOW_SECONDS`. */
export const REPORT_RATE_LIMIT = 5;
export const REPORT_RATE_WINDOW_SECONDS = 60 * 60;

/** Casella che riceve le segnalazioni; sovrascrivibile lato server con `SUPPORT_EMAIL_TO`. */
export const SUPPORT_EMAIL = "support@buddybudget.io";

/** Buy Me a Coffee page where people can support the project with a small donation. */
export const DONATION_URL = "https://buymeacoffee.com/yonder";

/** Repository open source dell'app: issue, release e policy di sicurezza. */
export const REPO_URL = "https://github.com/YonderUrik/buddy-budget";

/** Pagina pubblica con lo stato del servizio (UptimeRobot): da linkare dove l'utente cerca aiuto se l'app non risponde. */
export const STATUS_URL = "https://stats.uptimerobot.com/BCuTWm0Ukg";
