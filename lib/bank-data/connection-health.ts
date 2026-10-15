/** Durata del consenso GoCardless (`access_valid_for_days`): oltre va rinnovato. */
export const GOCARDLESS_CONSENT_DAYS = 90;
/**
 * Durata massima del consenso chiesta a Enable Banking (PSD2 dal 2023: fino a 180 giorni). Se la banca ne
 * ammette meno si usa il suo massimo (`maximum_consent_validity`).
 */
export const ENABLE_BANKING_MAX_CONSENT_DAYS = 180;
/** Durata usata quando la scadenza non è nota (connessioni vecchie senza data): la più breve tra i fornitori. */
export const CONSENT_VALID_DAYS = GOCARDLESS_CONSENT_DAYS;
/** Da quanti giorni prima della scadenza si avvisa l'utente (banner ed email). */
export const CONSENT_EXPIRY_WARNING_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** `pending`: collegamento non ancora completato; `expiring`: funziona ma scade a breve; `expired`/`error`: da rinnovare ora. */
export type ConnectionHealthState = "ok" | "expiring" | "expired" | "error" | "pending";

export interface ConnectionHealthInput {
  status: "pending" | "linked" | "expired" | "error";
  consentExpiresAt: Date | string | null;
}

export interface ConnectionHealth {
  state: ConnectionHealthState;
  /** Giorni al termine del consenso, arrotondati per eccesso (solo per `ok` e `expiring` con data nota). */
  daysLeft: number | null;
}

/**
 * Stato di salute di una connessione bancaria: unisce lo stato salvato (che passa a `expired` solo
 * quando un sync trova il consenso scaduto o gira il cron) con la data di scadenza del consenso, così l'utente è
 * avvisato anche prima del primo sync fallito.
 */
export function computeConnectionHealth(input: ConnectionHealthInput, now: Date): ConnectionHealth {
  if (input.status === "error") return { state: "error", daysLeft: null };
  if (input.status === "pending") return { state: "pending", daysLeft: null };
  if (input.status === "expired") return { state: "expired", daysLeft: null };
  if (!input.consentExpiresAt) return { state: "ok", daysLeft: null };
  const remainingMs = new Date(input.consentExpiresAt).getTime() - now.getTime();
  if (remainingMs <= 0) return { state: "expired", daysLeft: null };
  const daysLeft = Math.ceil(remainingMs / DAY_MS);
  return { state: daysLeft <= CONSENT_EXPIRY_WARNING_DAYS ? "expiring" : "ok", daysLeft };
}

/** True se all'utente va proposto "Rinnova" (anche quando la connessione funziona ancora). */
export function needsRenewal(state: ConnectionHealthState): boolean {
  return state === "expiring" || state === "expired" || state === "error";
}

/** Data di scadenza di un consenso di `days` giorni (default: GoCardless, 90) dato adesso. */
export function consentExpiryFrom(now: Date, days: number = GOCARDLESS_CONSENT_DAYS): Date {
  return new Date(now.getTime() + days * DAY_MS);
}
