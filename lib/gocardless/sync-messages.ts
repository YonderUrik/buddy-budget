import type { SyncResult } from "./sync";

export type SyncSuccessResult = Extract<SyncResult, { status: "synced" }>;

export type SyncErrorInfo =
  | { status: "not-eligible"; nextEligibleAt: string | null; syncsRemainingToday: number }
  | { status: "gocardless-limited" }
  | { status: "expired" }
  | { status: "already-running" }
  | { status: "unavailable" }
  | { status: "unknown" };

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Messaggio di successo dopo un sync riuscito, con i conteggi presi dopo il giro automatico: quante si sono messe da
 * sole (regole e proposte sicure) e quante restano da decidere in Categorizza.
 */
export function buildSyncSummaryMessage(result: SyncSuccessResult): string {
  if (result.newTransactionsCount === 0) {
    return "Nessuna nuova transazione trovata. Saldo aggiornato.";
  }
  const parts: string[] = [];
  if (result.categorizedCount > 0) {
    parts.push(`${result.categorizedCount} ${pluralize(result.categorizedCount, "categorizzata da sola", "categorizzate da sole")}`);
  }
  if (result.uncategorizedCount > 0) {
    parts.push(`${result.uncategorizedCount} da decidere`);
  }
  const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  const label = pluralize(result.newTransactionsCount, "nuova transazione", "nuove transazioni");
  return `${result.newTransactionsCount} ${label}${detail}. Saldo aggiornato.`;
}

/** Error message shown in the toast when a manual sync fails; the time is formatted in `locale`. */
export function buildSyncErrorMessage(error: SyncErrorInfo, locale = "it-IT"): string {
  switch (error.status) {
    case "not-eligible": {
      if (!error.nextEligibleAt) return "Sync non disponibile al momento. Riprova più tardi.";
      const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
        new Date(error.nextEligibleAt)
      );
      return `Hai raggiunto il limite giornaliero di sync. Prossimo disponibile alle ${time}.`;
    }
    case "gocardless-limited":
      return "La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi.";
    case "expired":
      return "Sessione con la banca scaduta. Riconnetti il conto per sincronizzare.";
    case "already-running":
      return "Sincronizzazione già in corso per questo conto.";
    case "unavailable":
      return "Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco.";
    default:
      return "Impossibile completare la sincronizzazione. Riprova più tardi.";
  }
}
