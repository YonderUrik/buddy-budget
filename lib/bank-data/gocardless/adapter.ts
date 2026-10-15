import "server-only";
import { consentExpiryFrom } from "../connection-health";
import type { BankDataProvider, BankTransactionRecord } from "../provider";
import { gocardlessRedirectUrl } from "../redirect";
import {
  GoCardlessError,
  createRequisition,
  deleteRequisition,
  getAccountBalances,
  getAccountDetails,
  getAccountTransactions,
  getRequisition,
  listInstitutions,
  type BankTransaction,
} from "./client";

/** Storico chiesto quando la banca non lo dichiara: il minimo che ogni banca dà (PSD2). */
const DEFAULT_HISTORY_DAYS = 90;
/** Stati di una requisition che non diventeranno mai `LN` (rifiutata, scaduta). */
const FAILED_REQUISITION_STATUSES = new Set(["RJ", "EX"]);

/** Movimento GoCardless nel formato comune; null se manca un id (non si potrebbe deduplicare). */
export function normalizeGoCardlessTransaction(transaction: BankTransaction): BankTransactionRecord | null {
  const externalId = transaction.internalTransactionId ?? transaction.transactionId;
  if (!externalId) return null;
  const rawDescription =
    transaction.remittanceInformationUnstructured ??
    (transaction.remittanceInformationUnstructuredArray?.join(" ").trim() || null);
  const isExpense = Number(transaction.transactionAmount.amount) < 0;
  return {
    externalId,
    amount: transaction.transactionAmount.amount,
    bookingDate: transaction.bookingDate,
    rawDescription,
    counterpartyName: (isExpense ? transaction.creditorName : transaction.debtorName)?.trim() || undefined,
    merchantCategoryCode: transaction.merchantCategoryCode?.trim() || undefined,
  };
}

/** GoCardless Bank Account Data: requisition + agreement, consenso di 90 giorni, header con le chiamate rimaste. */
export const goCardlessProvider: BankDataProvider = {
  id: "gocardless",

  isConfigured() {
    return Boolean(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY);
  },

  async listInstitutions(country) {
    const institutions = await listInstitutions(country);
    return institutions.map(({ id, name, logo, transaction_total_days }) => ({ id, name, logo, transaction_total_days }));
  },

  async startConsent({ connectionId, institutionId, historyDays, language }) {
    const requisition = await createRequisition({
      institutionId,
      maxHistoricalDays: historyDays ?? DEFAULT_HISTORY_DAYS,
      redirectUrl: gocardlessRedirectUrl(),
      reference: connectionId,
      language,
    });
    return { link: requisition.link, consentId: requisition.id, consentExpiresAt: consentExpiryFrom(new Date()) };
  },

  async completeConsent({ consentId, now }) {
    if (!consentId) return { ok: false, reason: "consent_failed" };
    const requisition = await getRequisition(consentId);
    if (requisition.status !== "LN") return { ok: false, reason: "consent_failed" };
    // Il consenso dura da quando l'utente lo dà (non da quando abbiamo creato la requisition).
    return { ok: true, consentId, consentExpiresAt: consentExpiryFrom(now) };
  },

  async consentStatus(consentId) {
    try {
      const { status } = await getRequisition(consentId);
      if (status === "LN") return "linked";
      return FAILED_REQUISITION_STATUSES.has(status) ? "failed" : "pending";
    } catch (error) {
      if (error instanceof GoCardlessError && error.status === 404) return "gone";
      throw error;
    }
  },

  async listConsentAccounts(consentId) {
    return (await getRequisition(consentId)).accounts;
  },

  getAccountDetails,

  async getBalance(externalAccountId) {
    const { balance, rateLimit } = await getAccountBalances(externalAccountId);
    return { amount: balance.balanceAmount.amount, currency: balance.balanceAmount.currency, rateLimit };
  },

  async getTransactions(externalAccountId) {
    const { transactions, rateLimit } = await getAccountTransactions(externalAccountId);
    return {
      transactions: transactions.map(normalizeGoCardlessTransaction).filter((t): t is BankTransactionRecord => t !== null),
      rateLimit,
    };
  },

  revokeConsent: deleteRequisition,
};
