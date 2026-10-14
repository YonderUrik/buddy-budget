import { localizedFormats } from "@/lib/localization/format";

/** Informazioni di sync di un conto collegato (stessa forma di `BankConnectionStatus`, ridotta a ciò che serve). */
export interface AccountSyncInfo {
  lastSyncedAt: string | null;
  eligible: boolean;
  nextEligibleAt: string | null;
  syncsRemainingToday: number;
}

export type AccountStatusTone = "ok" | "warning" | "progress" | "neutral";

/** Stato di un conto in una riga: testo sempre presente (mai solo colore) e tono per l'aspetto. */
export interface AccountStatus {
  tone: AccountStatusTone;
  label: string;
}

export interface AccountStatusInput {
  isAuto: boolean;
  needsReconnect?: boolean;
  syncing?: boolean;
  syncInfo?: AccountSyncInfo;
  now?: Date;
}
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedAccountStatus(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const { formatRelativeTime } = localizedFormats(locale);
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const SYNC_DAILY_LIMIT = 4;

/** Cosa dice la riga di un conto sotto al nome: riconnessione, sync in corso, ultimo aggiornamento o "a mano". */
function buildAccountStatus({ isAuto, needsReconnect, syncing, syncInfo, now = new Date() }: AccountStatusInput): AccountStatus {
  if (!isAuto) return { tone: "neutral", label: tr("Aggiornato da te") };
  if (needsReconnect) return { tone: "warning", label: tr("Da riconnettere") };
  if (syncing) return { tone: "progress", label: tr("Sincronizzazione in corso") };
  if (!syncInfo?.lastSyncedAt) return { tone: "neutral", label: tr("Mai sincronizzato") };
  return { tone: "ok", label: tr("Aggiornato {0}", { 0: formatRelativeTime(new Date(syncInfo.lastSyncedAt), now) }) };
}

/** Frase che spiega se e quando si può sincronizzare adesso: è il testo accanto al pulsante, non solo un tooltip. */
function describeSyncAvailability({ needsReconnect, syncing, syncInfo }: Omit<AccountStatusInput, "isAuto" | "now">): string {
  if (syncing) return tr("Sincronizzazione in corso.");
  if (needsReconnect) return tr("Riconnetti la banca per sincronizzare.");
  if (!syncInfo) return tr("Informazioni di sincronizzazione non disponibili.");
  if (syncInfo.eligible) return tr("Puoi sincronizzare adesso.");
  if (!syncInfo.nextEligibleAt) return tr("Sincronizzazione non disponibile.");
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(syncInfo.nextEligibleAt));
  return syncInfo.syncsRemainingToday === 0
    ? tr("Hai raggiunto il limite di {0} sincronizzazioni al giorno. Prossima alle {1}.", { 0: SYNC_DAILY_LIMIT, 1: time })
    : tr("Prossima sincronizzazione disponibile alle {0}.", { 0: time });
}

/** Somma dei saldi di un gruppo di conti (per il totale accanto al nome della banca). */
function sumBalances(accounts: { balance: string }[]): number {
  return accounts.reduce((sum, account) => sum + Number(account.balance), 0);
}
  return { SYNC_DAILY_LIMIT, buildAccountStatus, describeSyncAvailability, sumBalances };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { SYNC_DAILY_LIMIT, buildAccountStatus, describeSyncAvailability, sumBalances } = localizedAccountStatus("it");
