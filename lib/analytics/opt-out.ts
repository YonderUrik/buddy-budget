/** Chiave di localStorage che Umami legge per non inviare più nulla (Umami considera disattivato qualunque valore non vuoto). */
export const ANALYTICS_OPT_OUT_KEY = "umami.disabled";

/** Parte di `Storage` che serve qui: permette di provare la logica senza browser. */
export type OptOutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** True se l'utente ha chiesto di non essere misurato. Senza storage disponibile vale false. */
export function isAnalyticsOptedOut(storage: OptOutStorage | undefined): boolean {
  try {
    return Boolean(storage?.getItem(ANALYTICS_OPT_OUT_KEY));
  } catch {
    return false;
  }
}

/**
 * Attiva o disattiva l'opt-out. Per riattivare la chiave va rimossa (non basta scrivere "0": per Umami sarebbe
 * ancora un valore non vuoto). Ritorna false se lo storage non è scrivibile.
 */
export function setAnalyticsOptOut(storage: OptOutStorage | undefined, optedOut: boolean): boolean {
  try {
    if (!storage) return false;
    if (optedOut) storage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    else storage.removeItem(ANALYTICS_OPT_OUT_KEY);
    return true;
  } catch {
    return false;
  }
}
