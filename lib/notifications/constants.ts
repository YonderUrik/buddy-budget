/** Tipi di email non di servizio, con il testo con cui li spieghiamo nelle impostazioni e nel piè di pagina delle email. */
export const NOTIFICATION_KINDS = ["digest", "budget", "deadlines"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Che cosa disattiva un link di disiscrizione: un solo tipo oppure tutti. */
export const UNSUBSCRIBE_SCOPES = [...NOTIFICATION_KINDS, "all"] as const;
export type UnsubscribeScope = (typeof UNSUBSCRIBE_SCOPES)[number];

export const DIGEST_FREQUENCIES = ["settimanale", "mensile"] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

export interface NotificationKindInfo {
  label: string;
  /** Frase che completa "Ricevi questa email perché hai attivato …" nel piè di pagina. */
  reason: string;
  hint: string;
}

export const NOTIFICATION_KIND_INFO: Record<NotificationKind, NotificationKindInfo> = {
  digest: {
    label: "Riepilogo periodico",
    reason: "il riepilogo periodico",
    hint: "Entrate, spese e budget del periodo appena concluso, con le cifre che vedi già nell'app.",
  },
  budget: {
    label: "Avvisi sul budget",
    reason: "gli avvisi sul budget",
    hint: "Una email quando una categoria arriva all'80% del budget mensile e quando lo supera.",
  },
  deadlines: {
    label: "Avvisi sulle scadenze",
    reason: "gli avvisi sulle scadenze",
    hint: "Una email quando manca poco alla rata di un finanziamento, o quando è scaduta.",
  },
};

/** Preferenze di chi non le ha mai salvate. Tutto spento: queste email partono solo dopo una scelta esplicita (opt-in). */
export const NOTIFICATION_DEFAULTS = {
  digestEnabled: false,
  digestFrequency: "mensile" as DigestFrequency,
  budgetAlertsEnabled: false,
  deadlineAlertsEnabled: false,
};

export interface NotificationPreferences {
  digestEnabled: boolean;
  digestFrequency: DigestFrequency;
  budgetAlertsEnabled: boolean;
  deadlineAlertsEnabled: boolean;
}

/** Soglie (percentuale del budget mensile speso) che fanno scattare un avviso. */
export const BUDGET_ALERT_THRESHOLDS = [80, 100] as const;
/** Quanti giorni prima della scadenza di una rata parte l'avviso. */
export const DEADLINE_LEAD_DAYS = 3;
/** Tra due email di avviso (budget e scadenze insieme) passa almeno questo tempo. */
export const ALERT_MIN_INTERVAL_HOURS = 24;
/** Massimo di email di avviso (budget e scadenze insieme) in una settimana mobile. */
export const ALERT_MAX_PER_WEEK = 3;
/** Il riepilogo mensile parte nei primi giorni del mese, il settimanale il lunedì e il martedì: il cron è giornaliero, i giorni in più servono a ritentare. */
export const DIGEST_MONTHLY_MAX_DAY = 3;
export const DIGEST_WEEKLY_WEEKDAYS = [1, 2] as const;
/** Le righe del registro più vecchie di così si eliminano (la deduplica serve solo per il mese in corso). */
export const NOTIFICATION_LOG_RETENTION_DAYS = 90;
/** Email di prova dal pulsante in Impostazioni: massimo all'ora per utente. */
export const TEST_EMAIL_MAX_PER_HOUR = 3;
/** Tempo massimo di un giro del cron: oltre, si ferma e riprende al giro dopo (la deduplica evita i doppioni). */
export const RUN_TIME_BUDGET_MS = 240_000;
