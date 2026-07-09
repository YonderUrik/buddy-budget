import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { gocardlessToken } from "@/lib/db/schema/bank-connections";

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";
const TOKEN_ROW_ID = "singleton";

export class GoCardlessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GoCardlessError";
    this.status = status;
  }
}

async function fetchNewToken(): Promise<{ access: string; access_expires: number }> {
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error("GOCARDLESS_SECRET_ID/GOCARDLESS_SECRET_KEY non definite.");
  }
  const response = await fetch(`${BASE_URL}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  if (!response.ok) {
    throw new GoCardlessError("Impossibile ottenere il token GoCardless", response.status);
  }
  return response.json();
}

/** Restituisce un access token valido, riusando la cache DB o rigenerandolo se scaduto/assente. */
export async function getAccessToken(): Promise<string> {
  const [cached] = await db.select().from(gocardlessToken).where(eq(gocardlessToken.id, TOKEN_ROW_ID));
  if (cached && cached.expiresAt.getTime() > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const token = await fetchNewToken();
  const expiresAt = new Date(Date.now() + token.access_expires * 1000);
  await db
    .insert(gocardlessToken)
    .values({ id: TOKEN_ROW_ID, accessToken: token.access, expiresAt })
    .onConflictDoUpdate({
      target: gocardlessToken.id,
      set: { accessToken: token.access, expiresAt },
    });

  return token.access;
}

export interface RateLimitInfo {
  remaining: number;
  resetSeconds: number;
}

interface GoCardlessResponse<T> {
  data: T;
  rateLimit: RateLimitInfo | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<GoCardlessResponse<T>> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new GoCardlessError(`GoCardless ${path} ha risposto ${response.status}`, response.status);
  }

  const remainingHeader = response.headers.get("x-ratelimit-remaining");
  const resetHeader = response.headers.get("x-ratelimit-reset");
  const rateLimit =
    remainingHeader !== null && resetHeader !== null
      ? { remaining: Number(remainingHeader), resetSeconds: Number(resetHeader) }
      : null;

  return { data: (await response.json()) as T, rateLimit };
}

export interface Institution {
  id: string;
  name: string;
  transaction_total_days: string;
}

/** Elenca gli istituti bancari GoCardless disponibili in un paese (codice ISO 3166-1 alpha-2). */
export async function listInstitutions(country: string): Promise<Institution[]> {
  const { data } = await request<Institution[]>(`/institutions/?country=${country}`);
  return data;
}

export interface Requisition {
  id: string;
  status: string;
  link: string;
  accounts: string[];
}

/** Crea un End User Agreement (storico = tutto il disponibile) + una Requisition; restituisce il link di consenso. */
export async function createRequisition(params: {
  institutionId: string;
  maxHistoricalDays: number;
  redirectUrl: string;
  reference: string;
}): Promise<Requisition> {
  const { data: agreement } = await request<{ id: string }>("/agreements/enduser/", {
    method: "POST",
    body: JSON.stringify({
      institution_id: params.institutionId,
      max_historical_days: params.maxHistoricalDays,
      access_valid_for_days: 90,
      access_scope: ["balances", "details", "transactions"],
    }),
  });

  const { data: requisition } = await request<Requisition>("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      redirect: params.redirectUrl,
      institution_id: params.institutionId,
      reference: params.reference,
      agreement: agreement.id,
      user_language: "IT",
    }),
  });

  return requisition;
}

/** Stato aggiornato di una requisition (`accounts` è popolato solo dopo il consenso dell'utente). */
export async function getRequisition(requisitionId: string): Promise<Requisition> {
  const { data } = await request<Requisition>(`/requisitions/${requisitionId}/`);
  return data;
}

export interface AccountDetails {
  iban?: string;
  name?: string;
  product?: string;
}

/** Dettagli identificativi di un conto esterno (nome/IBAN), usati nella UI di selezione. */
export async function getAccountDetails(externalAccountId: string): Promise<AccountDetails> {
  const { data } = await request<{ account: AccountDetails }>(`/accounts/${externalAccountId}/details/`);
  return data.account;
}

export interface Balance {
  balanceAmount: { amount: string; currency: string };
  balanceType: string;
}

/** Saldo di un conto esterno: preferisce "interimAvailable", altrimenti il primo disponibile. */
export async function getAccountBalances(
  externalAccountId: string
): Promise<{ balance: Balance; rateLimit: RateLimitInfo | null }> {
  const { data, rateLimit } = await request<{ balances: Balance[] }>(`/accounts/${externalAccountId}/balances/`);
  const balance = data.balances.find((b) => b.balanceType === "interimAvailable") ?? data.balances[0];
  return { balance, rateLimit };
}

export interface BankTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  bookingDate: string;
}

/** Transazioni "booked" di un conto esterno (le "pending" non si importano, per evitare doppioni al booking). */
export async function getAccountTransactions(
  externalAccountId: string
): Promise<{ transactions: BankTransaction[]; rateLimit: RateLimitInfo | null }> {
  const { data, rateLimit } = await request<{
    transactions: { booked: BankTransaction[]; pending: BankTransaction[] };
  }>(`/accounts/${externalAccountId}/transactions/`);
  return { transactions: data.transactions.booked, rateLimit };
}
