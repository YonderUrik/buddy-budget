import { languageOfLocale } from "@/lib/localization/config";
import { translate, type MessageValues } from "@/lib/localization/messages";
import type { SyncResult } from "./sync";

export type SyncSuccessResult = Extract<SyncResult, { status: "synced" }>;

export type SyncErrorInfo =
  | { status: "not-eligible"; nextEligibleAt: string | null; syncsRemainingToday: number }
  | { status: "gocardless-limited" }
  | { status: "expired" }
  | { status: "already-running" }
  | { status: "unavailable" }
  | { status: "unknown" };

/** Translator for the language of `locale` ("en-GB" → English); messages are Italian sources from the catalogs. */
function translator(locale: string) {
  const language = languageOfLocale(locale);
  return (source: string, values?: MessageValues) => translate(language, source, values);
}

/**
 * Success message after a sync, with the counts taken after the automatic pass: how many were categorised on their own
 * (rules and safe suggestions) and how many are left to decide in Categorizza. Written in the language of `locale`.
 */
export function buildSyncSummaryMessage(result: SyncSuccessResult, locale = "it-IT"): string {
  const t = translator(locale);
  if (result.newTransactionsCount === 0) {
    return t("Nessuna nuova transazione trovata. Saldo aggiornato.");
  }
  const parts: string[] = [];
  if (result.categorizedCount > 0) {
    parts.push(t(result.categorizedCount === 1 ? "{0} categorizzata da sola" : "{0} categorizzate da sole", { 0: result.categorizedCount }));
  }
  if (result.uncategorizedCount > 0) {
    parts.push(t("{0} da decidere", { 0: result.uncategorizedCount }));
  }
  const single = result.newTransactionsCount === 1;
  if (parts.length === 0) {
    return t(single ? "{0} nuova transazione. Saldo aggiornato." : "{0} nuove transazioni. Saldo aggiornato.", { 0: result.newTransactionsCount });
  }
  return t(single ? "{0} nuova transazione ({1}). Saldo aggiornato." : "{0} nuove transazioni ({1}). Saldo aggiornato.", { 0: result.newTransactionsCount, 1: parts.join(", ") });
}

/** Error message shown in the toast when a manual sync fails, in the language of `locale` (which also formats the time). */
export function buildSyncErrorMessage(error: SyncErrorInfo, locale = "it-IT"): string {
  const t = translator(locale);
  switch (error.status) {
    case "not-eligible": {
      if (!error.nextEligibleAt) return t("Sync non disponibile al momento. Riprova più tardi.");
      const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
        new Date(error.nextEligibleAt)
      );
      return t("Hai raggiunto il limite giornaliero di sync. Prossimo disponibile alle {0}.", { 0: time });
    }
    case "gocardless-limited":
      return t("La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi.");
    case "expired":
      return t("Sessione con la banca scaduta. Riconnetti il conto per sincronizzare.");
    case "already-running":
      return t("Sincronizzazione già in corso per questo conto.");
    case "unavailable":
      return t("Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco.");
    default:
      return t("Impossibile completare la sincronizzazione. Riprova più tardi.");
  }
}
