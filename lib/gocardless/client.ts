import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { gocardlessToken } from "@/lib/db/schema/bank-connections";
import { recordGoCardlessApiRequest, type GoCardlessEndpoint } from "@/lib/observability";
import { CONSENT_VALID_DAYS } from "./connection-health";

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

/** Righe per pagina e pagine massime quando si elencano requisition e agreement (tetto di sicurezza). */
const LIST_PAGE_SIZE = 100;
const LIST_MAX_PAGES = 50;
const TOKEN_ROW_ID = "singleton";
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
/** Oltre questo tempo una chiamata GoCardless fallisce come errore invece di restare appesa fino al maxDuration della route. */
const GOCARDLESS_REQUEST_TIMEOUT_MS = 120_000;

/** Cache di modulo: vive quanto l'istanza della funzione; la riga DB resta la cache condivisa tra istanze. */
let memoryToken: { accessToken: string; expiresAt: number } | null = null;

/** Svuota la cache in memoria del token (solo per i test). */
export function resetAccessTokenCacheForTests(): void {
  memoryToken = null;
}

export class GoCardlessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GoCardlessError";
    this.status = status;
  }
}

/**
 * `fetch` con metrica `gocardless_api_requests_total` per endpoint (template statico, mai il path reale
 * che contiene id di conti/requisition). Un errore di rete conta come status 0 e viene rilanciato.
 */
async function observedFetch(endpoint: GoCardlessEndpoint, url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    recordGoCardlessApiRequest(endpoint, 0);
    throw error;
  }
  recordGoCardlessApiRequest(endpoint, response.status);
  return response;
}

async function fetchNewToken(): Promise<{ access: string; access_expires: number }> {
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error("GOCARDLESS_SECRET_ID/GOCARDLESS_SECRET_KEY non definite.");
  }
  const response = await observedFetch("token.new", `${BASE_URL}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  if (!response.ok) {
    throw new GoCardlessError("Impossibile ottenere il token GoCardless", response.status);
  }
  return response.json();
}

/** Restituisce un access token valido: memoria, poi cache DB, altrimenti ne genera uno nuovo. */
export async function getAccessToken(): Promise<string> {
  if (memoryToken && memoryToken.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
    return memoryToken.accessToken;
  }

  const [cached] = await db.select().from(gocardlessToken).where(eq(gocardlessToken.id, TOKEN_ROW_ID));
  if (cached && cached.expiresAt.getTime() > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
    memoryToken = { accessToken: cached.accessToken, expiresAt: cached.expiresAt.getTime() };
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

  memoryToken = { accessToken: token.access, expiresAt: expiresAt.getTime() };
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

async function request<T>(
  endpoint: GoCardlessEndpoint,
  path: string,
  init: RequestInit = {}
): Promise<GoCardlessResponse<T>> {
  const accessToken = await getAccessToken();
  const response = await observedFetch(endpoint, `${BASE_URL}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(GOCARDLESS_REQUEST_TIMEOUT_MS),
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });

  if (!response.ok) {
    // Solo template e status: il path reale contiene id di conti e il body può riportare dati del conto.
    throw new GoCardlessError(`GoCardless ${endpoint} ha risposto ${response.status}`, response.status);
  }

  const remainingHeader = response.headers.get("x-ratelimit-remaining");
  const resetHeader = response.headers.get("x-ratelimit-reset");
  const rateLimit =
    remainingHeader !== null && resetHeader !== null
      ? { remaining: Number(remainingHeader), resetSeconds: Number(resetHeader) }
      : null;

  return { data: (await response.json()) as T, rateLimit };
}

/** Valida che un id esterno (requisition/conto) non contenga separatori di path prima di finire in un URL. */
function assertSafePathSegment(value: string): void {
  if (value.includes("/") || value.includes("..") || value.includes("%2F") || value.includes("%2f")) {
    throw new Error(`Valore non valido per un segmento di path GoCardless: ${value}`);
  }
}

export interface Institution {
  id: string;
  name: string;
  transaction_total_days: string;
  logo?: string;
}

/** Elenca gli istituti bancari GoCardless disponibili in un paese (codice ISO 3166-1 alpha-2). */
export async function listInstitutions(country: string): Promise<Institution[]> {
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error(`Codice paese non valido (atteso ISO 3166-1 alpha-2): ${country}`);
  }
  const { data } = await request<Institution[]>("institutions.list", `/institutions/?country=${encodeURIComponent(country)}`);
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
  const { data: agreement } = await request<{ id: string }>("agreements.create", "/agreements/enduser/", {
    method: "POST",
    body: JSON.stringify({
      institution_id: params.institutionId,
      max_historical_days: params.maxHistoricalDays,
      access_valid_for_days: CONSENT_VALID_DAYS,
      access_scope: ["balances", "details", "transactions"],
    }),
  });

  const { data: requisition } = await request<Requisition>("requisitions.create", "/requisitions/", {
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
  assertSafePathSegment(requisitionId);
  const { data } = await request<Requisition>("requisitions.get", `/requisitions/${encodeURIComponent(requisitionId)}/`);
  return data;
}

/**
 * Elimina una requisition: GoCardless revoca il consenso e smette di esporre i conti collegati.
 * Una requisition già eliminata o scaduta (404) conta come revocata.
 */
export async function deleteRequisition(requisitionId: string): Promise<void> {
  assertSafePathSegment(requisitionId);
  try {
    await request<unknown>("requisitions.delete", `/requisitions/${encodeURIComponent(requisitionId)}/`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof GoCardlessError && error.status === 404) return;
    throw error;
  }
}

/** Requisition come elencata dall'API: `created` (ISO), `agreement` e `reference` (id della nostra connessione). */
export interface RemoteRequisition {
  id: string;
  created: string;
  status: string;
  reference?: string;
  agreement?: string;
}

export interface RemoteAgreement {
  id: string;
  created: string;
}

interface Page<T> {
  next: string | null;
  results: T[];
}

async function listAll<T>(endpoint: "requisitions.list" | "agreements.list", path: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < LIST_MAX_PAGES; page += 1) {
    const { data } = await request<Page<T>>(endpoint, `${path}?limit=${LIST_PAGE_SIZE}&offset=${page * LIST_PAGE_SIZE}`);
    all.push(...data.results);
    if (!data.next || data.results.length === 0) return all;
  }
  throw new Error(`Elenco GoCardless ${endpoint} oltre ${LIST_MAX_PAGES} pagine: interrotto per sicurezza`);
}

/** Tutte le requisition dell'account GoCardless (paginate). */
export function listRequisitions(): Promise<RemoteRequisition[]> {
  return listAll<RemoteRequisition>("requisitions.list", "/requisitions/");
}

/** Tutti gli End User Agreement dell'account GoCardless (paginati). */
export function listAgreements(): Promise<RemoteAgreement[]> {
  return listAll<RemoteAgreement>("agreements.list", "/agreements/enduser/");
}

/** Elimina un agreement non più referenziato da nessuna requisition. Un 404 conta come già eliminato. */
export async function deleteAgreement(agreementId: string): Promise<void> {
  assertSafePathSegment(agreementId);
  try {
    await request<unknown>("agreements.delete", `/agreements/enduser/${encodeURIComponent(agreementId)}/`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof GoCardlessError && error.status === 404) return;
    throw error;
  }
}

export interface AccountDetails {
  iban?: string;
  name?: string;
  product?: string;
}

/** Dettagli identificativi di un conto esterno (nome/IBAN), usati nella UI di selezione. */
export async function getAccountDetails(externalAccountId: string): Promise<AccountDetails> {
  assertSafePathSegment(externalAccountId);
  const { data } = await request<{ account: AccountDetails }>(
    "accounts.details",
    `/accounts/${encodeURIComponent(externalAccountId)}/details/`
  );
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
  assertSafePathSegment(externalAccountId);
  const { data, rateLimit } = await request<{ balances: Balance[] }>(
    "accounts.balances",
    `/accounts/${encodeURIComponent(externalAccountId)}/balances/`
  );
  const balance = data.balances.find((b) => b.balanceType === "interimAvailable") ?? data.balances[0];
  if (!balance) {
    throw new Error(`Nessun saldo disponibile per il conto ${externalAccountId}`);
  }
  return { balance, rateLimit };
}

export interface BankTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  bookingDate: string;
  creditorName?: string;
  debtorName?: string;
}

/** Transazioni "booked" di un conto esterno (le "pending" non si importano, per evitare doppioni al booking). */
export async function getAccountTransactions(
  externalAccountId: string
): Promise<{ transactions: BankTransaction[]; rateLimit: RateLimitInfo | null }> {
  assertSafePathSegment(externalAccountId);
  const { data, rateLimit } = await request<{
    transactions: { booked: BankTransaction[]; pending: BankTransaction[] };
  }>("accounts.transactions", `/accounts/${encodeURIComponent(externalAccountId)}/transactions/`);
  return { transactions: data.transactions.booked, rateLimit };
}
