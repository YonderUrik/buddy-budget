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

/** Frase mostrata nel banner per una connessione da rinnovare. */
export function describeRenewalAlert(alert: RenewalAlert): string {
  if (alert.state === "expiring") {
    const when = alert.daysLeft === 1 ? "domani" : `tra ${alert.daysLeft} giorni`;
    return `Il collegamento con ${alert.institutionName} scade ${when}.`;
  }
  if (alert.state === "error") return `Il collegamento con ${alert.institutionName} non è andato a buon fine.`;
  return `Il collegamento con ${alert.institutionName} è scaduto: i conti non si aggiornano.`;
}
