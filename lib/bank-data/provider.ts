import type { BankProviderId } from "@/lib/observability";

export type { BankProviderId };

/** Banca come la mostra la scelta «Collega la tua banca», uguale per ogni fornitore. */
export interface BankInstitution {
  /** Id stabile presso il fornitore (GoCardless: `INTESA_SANPAOLO_BCITITMM`; Enable Banking: `IT:Intesa Sanpaolo`). */
  id: string;
  name: string;
  logo?: string;
  /** Giorni di storico dichiarati dalla banca, se il fornitore li dà (stringa come nell'API GoCardless). */
  transaction_total_days?: string;
  /** Durata massima del consenso per questa banca, in giorni, se il fornitore la dà. */
  max_consent_days?: number;
}

/** Dettagli identificativi di un conto esterno (nome/IBAN), usati nella scelta dei conti da collegare. */
export interface BankAccountDetails {
  iban?: string;
  name?: string;
  product?: string;
}

/** Chiamate ancora disponibili per un conto/endpoint, se il fornitore le comunica. */
export interface RateLimitInfo {
  remaining: number;
  resetSeconds: number;
}

/** Movimento contabilizzato, già normalizzato: importo con segno (negativo = uscita), data `YYYY-MM-DD`. */
export interface BankTransactionRecord {
  /** Id univoco del movimento nel conto, già con il prefisso del fornitore quando serve (vedi `externalIdPrefix`). */
  externalId: string;
  amount: string;
  bookingDate: string;
  /** Causale grezza della banca (righe unite da uno spazio), null se assente. */
  rawDescription: string | null;
  /** Controparte: chi riceve per un'uscita, chi paga per un'entrata. */
  counterpartyName?: string;
  /** Codice di categoria dell'esercente (ISO 18245), solo se la banca lo fornisce. */
  merchantCategoryCode?: string;
}

/** Motivo normalizzato di un errore del fornitore: decide cosa fa l'app (segna scaduto, aspetta, avvisa). */
export type BankErrorReason = "expired" | "rate_limited" | "provider_limit" | "not_found" | "other";

/**
 * Errore di un fornitore bancario. Il messaggio contiene solo endpoint (template) e status, mai il path
 * reale o il body: possono riportare id di conti e dati personali.
 */
export class BankProviderError extends Error {
  readonly provider: BankProviderId;
  readonly status: number;
  readonly reason: BankErrorReason;
  constructor(message: string, provider: BankProviderId, status: number, reason: BankErrorReason) {
    super(message);
    this.name = "BankProviderError";
    this.provider = provider;
    this.status = status;
    this.reason = reason;
  }
}

/** Esito del ritorno dalla banca: consenso confermato (con id e scadenza) oppure rifiutato/annullato. */
export type ConsentCompletion =
  | { ok: true; consentId: string; consentExpiresAt: Date }
  | { ok: false; reason: "consent_failed" | "missing_code" };

/**
 * Cosa deve saper fare un fornitore di dati bancari (Open Banking, servizio AIS): il resto dell'app
 * (limiti, sync, rinnovi, avvisi, pulizia) è uguale per tutti e passa solo da qui.
 * «Consenso» = requisition su GoCardless, sessione su Enable Banking.
 */
export interface BankDataProvider {
  id: BankProviderId;
  /** Se le credenziali del fornitore sono configurate nell'ambiente. */
  isConfigured(): boolean;
  listInstitutions(country: string): Promise<BankInstitution[]>;
  /**
   * Avvia il consenso e restituisce il link della banca. `consentId` è già noto per GoCardless (la requisition
   * nasce subito), null per Enable Banking (la sessione nasce solo al ritorno dalla banca).
   */
  startConsent(input: {
    connectionId: string;
    institutionId: string;
    historyDays?: number;
    language: "IT" | "EN" | "DE";
  }): Promise<{ link: string; consentId: string | null; consentExpiresAt: Date }>;
  /** Chiude il ritorno dalla banca: `query` sono i parametri dell'URL di callback. */
  completeConsent(input: { consentId: string | null; query: URLSearchParams; now: Date }): Promise<ConsentCompletion>;
  /** Stato remoto di un consenso, per la pulizia: `linked` = dato e valido, `gone` = non esiste più. */
  consentStatus(consentId: string): Promise<"linked" | "pending" | "gone" | "failed">;
  /** Id esterni dei conti autorizzati da un consenso (gli unici collegabili). */
  listConsentAccounts(consentId: string): Promise<string[]>;
  getAccountDetails(externalAccountId: string): Promise<BankAccountDetails>;
  getBalance(externalAccountId: string): Promise<{ amount: string; currency: string; rateLimit: RateLimitInfo | null }>;
  /**
   * Movimenti contabilizzati. `since` = ultimo sync riuscito: null al primo import (si chiede tutto lo storico
   * disponibile). GoCardless lo ignora (restituisce sempre la sua finestra).
   */
  getTransactions(
    externalAccountId: string,
    options: { since: Date | null }
  ): Promise<{ transactions: BankTransactionRecord[]; rateLimit: RateLimitInfo | null }>;
  /** Revoca il consenso presso il fornitore. Idempotente: un consenso già sparito conta come revocato. */
  revokeConsent(consentId: string): Promise<void>;
}

/**
 * Prefisso degli id esterni dei movimenti per fornitore. GoCardless non ne ha (righe storiche), Enable Banking
 * usa `eb:`: così il sync distingue i movimenti già arrivati da GoCardless e non li duplica al passaggio.
 */
export function externalIdPrefix(provider: BankProviderId): string {
  return provider === "enablebanking" ? "eb:" : "";
}
