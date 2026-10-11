/**
 * Regole pure sull'inattività degli account: quando avvisare, quando eliminare, chi rientra.
 * Nessun accesso a database o rete, così le date si simulano nei test.
 */
import { INACTIVITY_DELETE_AFTER_DAYS, INACTIVITY_WARNING_LEAD_DAYS } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Modalità del cron: `off` non fa nulla, `dry-run` (default) conta senza scrivere né inviare, `execute` agisce davvero. */
export type InactivityRunMode = "off" | "dry-run" | "execute";

/** Legge `INACTIVITY_CLEANUP_MODE`: qualunque valore sconosciuto ricade su `dry-run`, mai su `execute`. */
export function parseInactivityMode(value: string | undefined): InactivityRunMode {
  return value === "off" || value === "execute" ? value : "dry-run";
}

/** Stato di un account rispetto all'inattività: ciò che serve a decidere, senza dati personali. */
export interface InactivityState {
  /** Ultimo accesso noto (il più recente tra il campo dell'utente e le sue sessioni). */
  lastActiveAt: Date;
  /** Quando è partito l'avviso, se è partito. */
  warnedAt: Date | null;
}

/** Cosa fare di un account in questo giro. */
export type InactivityDecision =
  /** Nessuna azione: attivo, oppure avvisato e ancora nel periodo di preavviso. */
  | "none"
  /** Ha fatto un accesso dopo l'avviso: l'avviso si azzera. */
  | "returned"
  /** Inattivo da abbastanza tempo: va mandato l'avviso. */
  | "warn"
  /** Avvisato da almeno il preavviso e ancora inattivo: va eliminato. */
  | "delete";

/** Primo istante in cui l'account va avvisato: `INACTIVITY_DELETE_AFTER_DAYS - INACTIVITY_WARNING_LEAD_DAYS` giorni dopo l'ultimo accesso. */
export function warningDueAt(lastActiveAt: Date): Date {
  return new Date(lastActiveAt.getTime() + (INACTIVITY_DELETE_AFTER_DAYS - INACTIVITY_WARNING_LEAD_DAYS) * DAY_MS);
}

/**
 * Data di eliminazione comunicata all'utente: `INACTIVITY_DELETE_AFTER_DAYS` dopo l'ultimo accesso, ma mai prima di
 * `INACTIVITY_WARNING_LEAD_DAYS` dopo l'avviso (se il cron ha ritardato, il preavviso resta intero).
 */
export function deletionDueAt(lastActiveAt: Date, warnedAt: Date): Date {
  const byInactivity = lastActiveAt.getTime() + INACTIVITY_DELETE_AFTER_DAYS * DAY_MS;
  const byNotice = warnedAt.getTime() + INACTIVITY_WARNING_LEAD_DAYS * DAY_MS;
  return new Date(Math.max(byInactivity, byNotice));
}

/**
 * Decide che cosa fare di un account. Non si elimina mai senza un avviso già partito e non si avvisa chi
 * ha fatto accesso dopo l'avviso: qualunque accesso riporta l'orologio a zero.
 */
export function decideInactivity(state: InactivityState, now: Date): InactivityDecision {
  if (state.warnedAt) {
    if (state.lastActiveAt.getTime() > state.warnedAt.getTime()) return "returned";
    return now.getTime() >= deletionDueAt(state.lastActiveAt, state.warnedAt).getTime() ? "delete" : "none";
  }
  return now.getTime() >= warningDueAt(state.lastActiveAt).getTime() ? "warn" : "none";
}

/** Istante prima del quale un ultimo accesso rende l'account candidato all'avviso (per la query di pre-selezione). */
export function warningCutoff(now: Date): Date {
  return new Date(now.getTime() - (INACTIVITY_DELETE_AFTER_DAYS - INACTIVITY_WARNING_LEAD_DAYS) * DAY_MS);
}

/** Giorni interi trascorsi dall'ultimo accesso (per il log: un conteggio, non un dato personale). */
export function inactiveDays(lastActiveAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - lastActiveAt.getTime()) / DAY_MS));
}
