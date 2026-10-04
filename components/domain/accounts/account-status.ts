import { formatRelativeTime } from "@/lib/format";

/** Informazioni di sync di un conto collegato (stessa forma di `BankConnectionStatus`, ridotta a ciò che serve). */
export interface AccountSyncInfo {
  lastSyncedAt: string | null;
  eligible: boolean;
  nextEligibleAt: string | null;
  syncsRemainingToday: number;
}

/** Limite di sync al giorno, citato nel messaggio quando è esaurito. */
export const SYNC_DAILY_LIMIT = 4;

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

/** Cosa dice la riga di un conto sotto al nome: riconnessione, sync in corso, ultimo aggiornamento o "a mano". */
export function buildAccountStatus({ isAuto, needsReconnect, syncing, syncInfo, now = new Date() }: AccountStatusInput): AccountStatus {
  if (!isAuto) return { tone: "neutral", label: "Aggiornato da te" };
  if (needsReconnect) return { tone: "warning", label: "Da riconnettere" };
  if (syncing) return { tone: "progress", label: "Sincronizzazione in corso" };
  if (!syncInfo?.lastSyncedAt) return { tone: "neutral", label: "Mai sincronizzato" };
  return { tone: "ok", label: `Aggiornato ${formatRelativeTime(new Date(syncInfo.lastSyncedAt), now)}` };
}

/** Frase che spiega se e quando si può sincronizzare adesso: è il testo accanto al pulsante, non solo un tooltip. */
export function describeSyncAvailability({ needsReconnect, syncing, syncInfo }: Omit<AccountStatusInput, "isAuto" | "now">): string {
  if (syncing) return "Sincronizzazione in corso.";
  if (needsReconnect) return "Riconnetti la banca per sincronizzare.";
  if (!syncInfo) return "Informazioni di sincronizzazione non disponibili.";
  if (syncInfo.eligible) return "Puoi sincronizzare adesso.";
  if (!syncInfo.nextEligibleAt) return "Sincronizzazione non disponibile.";
  const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(syncInfo.nextEligibleAt));
  return syncInfo.syncsRemainingToday === 0
    ? `Hai raggiunto il limite di ${SYNC_DAILY_LIMIT} sincronizzazioni al giorno. Prossima alle ${time}.`
    : `Prossima sincronizzazione disponibile alle ${time}.`;
}

/** Somma dei saldi di un gruppo di conti (per il totale accanto al nome della banca). */
export function sumBalances(accounts: { balance: string }[]): number {
  return accounts.reduce((sum, account) => sum + Number(account.balance), 0);
}
