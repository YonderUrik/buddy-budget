/** Durata del consenso richiesta alla banca (`access_valid_for_days`): oltre va rinnovato. */
export const CONSENT_VALID_DAYS = 90;
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
 * quando un sync riceve 401 o gira il cron) con la data di scadenza del consenso, così l'utente è
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

/** Data di scadenza del consenso per un collegamento completato adesso. */
export function consentExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + CONSENT_VALID_DAYS * DAY_MS);
}
