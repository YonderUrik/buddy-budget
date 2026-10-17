import type { Language } from "@/lib/localization/config";
import { translate, type MessageValues } from "@/lib/localization/messages";
import { computeConnectionHealth, needsRenewal, type ConnectionHealthState } from "@/lib/gocardless/connection-health";

/** Minimo dei dati di una connessione necessario a decidere cosa mostrare (compatibile con `BankConnectionStatus`). */
export interface RenewalSource {
  connectionId: string;
  institutionName: string;
  status: "pending" | "linked" | "expired" | "error";
  consentExpiresAt: string | null;
}

export interface RenewalAlert {
  connectionId: string;
  institutionName: string;
  state: Extract<ConnectionHealthState, "expiring" | "expired" | "error">;
  /** Giorni rimasti (solo `expiring`). */
  daysLeft: number | null;
}

/** Connessioni da rinnovare (una per connessione, anche con più conti), le scadute/in errore prima di quelle in scadenza. */
export function buildRenewalAlerts(sources: RenewalSource[], now: Date): RenewalAlert[] {
  const byConnection = new Map<string, RenewalAlert>();
  for (const source of sources) {
    if (byConnection.has(source.connectionId)) continue;
    const health = computeConnectionHealth(source, now);
    if (!needsRenewal(health.state)) continue;
    byConnection.set(source.connectionId, {
      connectionId: source.connectionId,
      institutionName: source.institutionName,
      state: health.state as RenewalAlert["state"],
      daysLeft: health.daysLeft,
    });
  }
  const urgency = (alert: RenewalAlert) => (alert.state === "expiring" ? 1 : 0);
  return [...byConnection.values()].sort((a, b) => urgency(a) - urgency(b));
}

/** Sentence shown in the banner for a connection to renew, in `language`. */
export function describeRenewalAlert(alert: RenewalAlert, language: Language = "it"): string {
  const t = (source: string, values?: MessageValues) => translate(language, source, values);
  if (alert.state === "expiring") {
    return alert.daysLeft === 1
      ? t("Il collegamento con {0} scade domani.", { 0: alert.institutionName })
      : t("Il collegamento con {0} scade tra {1} giorni.", { 0: alert.institutionName, 1: alert.daysLeft });
  }
  if (alert.state === "error") return t("Il collegamento con {0} non è andato a buon fine.", { 0: alert.institutionName });
  return t("Il collegamento con {0} è scaduto: i conti non si aggiornano.", { 0: alert.institutionName });
}
