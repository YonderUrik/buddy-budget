import "server-only";
import { createHash } from "node:crypto";
import { ENABLE_BANKING_MAX_CONSENT_DAYS, GOCARDLESS_CONSENT_DAYS } from "../connection-health";
import { externalIdPrefix, type BankDataProvider, type BankInstitution, type BankTransactionRecord } from "../provider";
import { bankCallbackUrl } from "../redirect";
import {
  EnableBankingError,
  createSession,
  deleteSession,
  getAccountBalances,
  getAccountDetails,
  getAccountTransactions,
  getSession,
  isEnableBankingConfigured,
  listAspsps,
  startAuthorization,
  type Aspsp,
  type EnableBankingBalance,
  type EnableBankingTransaction,
} from "./client";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Elenco delle banche in memoria: cambia di rado e la scelta «Collega» lo chiede a ogni apertura. */
const ASPSP_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/**
 * Giorni ripresi a ogni sync rispetto all'ultimo riuscito: una banca può contabilizzare con qualche giorno di
 * ritardo (data contabile nel passato). I doppioni li scarta l'indice unico su (conto, id esterno).
 */
export const SYNC_OVERLAP_DAYS = 30;
/** Tipi di saldo in ordine di preferenza (ISO 20022): disponibile in giornata, poi contabile. */
const BALANCE_PREFERENCE = ["ITAV", "CLAV", "ITBD", "CLBD", "XPCD", "OPAV"];

const aspspCache = new Map<string, { at: number; aspsps: Aspsp[] }>();

/** Svuota la cache delle banche (solo per i test). */
export function resetAspspCacheForTests(): void {
  aspspCache.clear();
}

async function cachedAspsps(country: string): Promise<Aspsp[]> {
  const hit = aspspCache.get(country);
  if (hit && Date.now() - hit.at < ASPSP_CACHE_TTL_MS) return hit.aspsps;
  const aspsps = await listAspsps(country);
  aspspCache.set(country, { at: Date.now(), aspsps });
  return aspsps;
}

/** Id di una banca Enable Banking: le banche si identificano con nome + paese, qui uniti in `IT:Nome banca`. */
export function enableBankingInstitutionId(aspsp: { country: string; name: string }): string {
  return `${aspsp.country}:${aspsp.name}`;
}

/** Inverso di `enableBankingInstitutionId`; null se l'id non ha il formato atteso. */
export function parseEnableBankingInstitutionId(id: string): { country: string; name: string } | null {
  const match = /^([A-Z]{2}):(.+)$/.exec(id);
  return match ? { country: match[1], name: match[2] } : null;
}

/** Giorni di consenso da chiedere: il massimo della banca, senza superare i 180 di PSD2; 90 se la banca non lo dice. */
export function consentDaysFor(aspsp: Pick<Aspsp, "maximum_consent_validity"> | undefined): number {
  const maxSeconds = aspsp?.maximum_consent_validity;
  if (!maxSeconds || maxSeconds <= 0) return GOCARDLESS_CONSENT_DAYS;
  return Math.max(1, Math.min(ENABLE_BANKING_MAX_CONSENT_DAYS, Math.floor(maxSeconds / 86_400)));
}

/** Il saldo da mostrare: il primo tipo disponibile secondo `BALANCE_PREFERENCE`, altrimenti il primo restituito. */
export function pickBalance(balances: EnableBankingBalance[]): EnableBankingBalance | undefined {
  for (const type of BALANCE_PREFERENCE) {
    const found = balances.find((balance) => balance.balance_type === type);
    if (found) return found;
  }
  return balances[0];
}

function signedAmount(transaction: EnableBankingTransaction): string {
  const absolute = transaction.transaction_amount.amount.replace(/^[-+]/, "");
  if (transaction.credit_debit_indicator === "DBIT") return `-${absolute}`;
  if (transaction.credit_debit_indicator === "CRDT") return absolute;
  return transaction.transaction_amount.amount;
}

/**
 * Movimenti Enable Banking nel formato comune. Tiene solo i contabilizzati (`BOOK`, o senza stato), con importo
 * col segno da `credit_debit_indicator`. Id: `entry_reference` della banca, poi `transaction_id`; se mancano
 * entrambi un'impronta di data, importo, causale e controparte con il numero d'ordine tra gli identici, così due
 * caffè uguali nello stesso giorno restano due movimenti e lo stesso movimento riletto ha lo stesso id.
 */
export function normalizeEnableBankingTransactions(transactions: EnableBankingTransaction[]): BankTransactionRecord[] {
  const prefix = externalIdPrefix("enablebanking");
  const seen = new Map<string, number>();
  const records: BankTransactionRecord[] = [];
  for (const transaction of transactions) {
    if (transaction.status && transaction.status !== "BOOK") continue;
    const bookingDate = transaction.booking_date ?? transaction.value_date ?? transaction.transaction_date;
    if (!bookingDate) continue;
    const amount = signedAmount(transaction);
    const rawDescription = transaction.remittance_information?.map((line) => line.trim()).filter(Boolean).join(" ") || null;
    const isExpense = Number(amount) < 0;
    const counterpartyName = (isExpense ? transaction.creditor?.name : transaction.debtor?.name)?.trim() || undefined;
    let id = transaction.entry_reference?.trim() || transaction.transaction_id?.trim();
    if (!id) {
      const base = [bookingDate, amount, rawDescription ?? "", counterpartyName ?? ""].join("|");
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);
      id = `h:${createHash("sha256").update(`${base}|${occurrence}`).digest("hex").slice(0, 32)}`;
    }
    records.push({
      externalId: `${prefix}${id}`,
      amount,
      bookingDate: bookingDate.slice(0, 10),
      rawDescription,
      counterpartyName,
      merchantCategoryCode: transaction.merchant_category_code?.trim() || undefined,
    });
  }
  return records;
}

/** Data `YYYY-MM-DD` da cui rileggere i movimenti, `SYNC_OVERLAP_DAYS` prima dell'ultimo sync riuscito. */
export function transactionsDateFrom(since: Date | null): string | null {
  if (!since) return null;
  return new Date(since.getTime() - SYNC_OVERLAP_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Enable Banking: autorizzazione con JWT firmato da noi, sessione creata al ritorno dalla banca (`code`),
 * consenso fino a 180 giorni, nessun elenco remoto delle sessioni.
 */
export const enableBankingProvider: BankDataProvider = {
  id: "enablebanking",

  isConfigured() {
    return isEnableBankingConfigured();
  },

  async listInstitutions(country) {
    const aspsps = await cachedAspsps(country);
    return aspsps.map(
      (aspsp): BankInstitution => ({
        id: enableBankingInstitutionId(aspsp),
        name: aspsp.name,
        logo: aspsp.logo,
        max_consent_days: consentDaysFor(aspsp),
      })
    );
  },

  async startConsent({ connectionId, institutionId, language }) {
    const aspsp = parseEnableBankingInstitutionId(institutionId);
    if (!aspsp) throw new Error("Id banca Enable Banking non valido");
    // La durata massima dipende dalla banca: se l'elenco non risponde si chiede la durata prudente (90 giorni).
    const known = await cachedAspsps(aspsp.country)
      .then((list) => list.find((item) => item.name === aspsp.name))
      .catch(() => undefined);
    const validUntil = new Date(Date.now() + consentDaysFor(known) * DAY_MS);
    const { url } = await startAuthorization({
      aspsp,
      validUntil,
      redirectUrl: bankCallbackUrl(),
      state: connectionId,
      language: language.toLowerCase(),
    });
    return { link: url, consentId: null, consentExpiresAt: validUntil };
  },

  async completeConsent({ query }) {
    if (query.get("error")) return { ok: false, reason: "consent_failed" };
    const code = query.get("code");
    if (!code) return { ok: false, reason: "missing_code" };
    const session = await createSession(code);
    return { ok: true, consentId: session.session_id, consentExpiresAt: new Date(session.access.valid_until) };
  },

  async consentStatus(consentId) {
    try {
      const { status } = await getSession(consentId);
      if (status === "AUTHORIZED") return "linked";
      if (status === "PENDING_AUTHORIZATION" || status === "RETURNED_FROM_BANK") return "pending";
      if (status === "CANCELLED" || status === "INVALID") return "failed";
      return "gone";
    } catch (error) {
      if (error instanceof EnableBankingError && (error.reason === "expired" || error.reason === "not_found")) return "gone";
      throw error;
    }
  },

  async listConsentAccounts(consentId) {
    return (await getSession(consentId)).accounts;
  },

  async getAccountDetails(externalAccountId) {
    const account = await getAccountDetails(externalAccountId);
    return {
      iban: account.account_id?.iban ?? undefined,
      name: account.name ?? undefined,
      product: account.product ?? undefined,
    };
  },

  async getBalance(externalAccountId) {
    const balance = pickBalance(await getAccountBalances(externalAccountId));
    if (!balance) throw new Error("Nessun saldo disponibile per il conto");
    return { amount: balance.balance_amount.amount, currency: balance.balance_amount.currency, rateLimit: null };
  },

  async getTransactions(externalAccountId, { since }) {
    const transactions = await getAccountTransactions(externalAccountId, transactionsDateFrom(since));
    return { transactions: normalizeEnableBankingTransactions(transactions), rateLimit: null };
  },

  revokeConsent: deleteSession,
};
