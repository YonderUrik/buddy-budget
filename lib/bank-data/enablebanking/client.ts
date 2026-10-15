import "server-only";
import { createPrivateKey, sign, type KeyObject } from "node:crypto";
import { recordBankApiRequest, type EnableBankingEndpoint } from "@/lib/observability";
import { BankProviderError, type BankErrorReason } from "../provider";

/** API Enable Banking (stesso indirizzo per sandbox e produzione: l'ambiente lo decide l'applicazione del `kid`). */
const BASE_URL = "https://api.enablebanking.com";
/** Durata del JWT firmato da noi: l'API accetta al massimo 24 ore; uno breve limita i danni se trapela. */
const JWT_TTL_SECONDS = 3600;
const JWT_RENEW_MARGIN_SECONDS = 300;
/** Oltre questo tempo una chiamata fallisce come errore invece di restare appesa fino al maxDuration della route. */
const REQUEST_TIMEOUT_MS = 120_000;
/** Tetto di pagine (`continuation_key`) per una sola lettura dei movimenti: protegge da cicli infiniti. */
const TRANSACTIONS_MAX_PAGES = 50;

/** Codici d'errore Enable Banking che vogliono dire «consenso non più valido»: si chiede all'utente di rinnovare. */
const EXPIRED_ERRORS = new Set(["EXPIRED_SESSION", "REVOKED_SESSION", "CLOSED_SESSION", "SESSION_DOES_NOT_EXIST"]);
const RATE_LIMIT_ERRORS = new Set(["ASPSP_RATE_LIMIT_EXCEEDED"]);

/** Errore dell'API Enable Banking con il codice (`ErrorCode`) se l'API lo ha dato. */
export class EnableBankingError extends BankProviderError {
  readonly code: string | null;
  constructor(endpoint: EnableBankingEndpoint, status: number, code: string | null) {
    super(`Enable Banking ${endpoint} ha risposto ${status}${code ? ` (${code})` : ""}`, "enablebanking", status, reasonFor(status, code));
    this.name = "EnableBankingError";
    this.code = code;
  }
}

function reasonFor(status: number, code: string | null): BankErrorReason {
  if (code && EXPIRED_ERRORS.has(code)) return "expired";
  if (status === 429 || (code && RATE_LIMIT_ERRORS.has(code))) return "rate_limited";
  if (status === 404) return "not_found";
  return "other";
}

/** Credenziali dell'applicazione Enable Banking: id (il `kid` del JWT) e chiave privata RSA scaricata alla registrazione. */
export function isEnableBankingConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ENABLE_BANKING_APP_ID?.trim() && env.ENABLE_BANKING_PRIVATE_KEY?.trim());
}

/**
 * Legge la chiave privata da `ENABLE_BANKING_PRIVATE_KEY`: il PEM così com'è, con `\n` letterali (variabili su una
 * riga sola) oppure codificato in base64 (comodo nei Secret).
 */
export function parsePrivateKey(raw: string): KeyObject {
  const value = raw.trim();
  const pem = value.includes("BEGIN") ? value.replace(/\\n/g, "\n") : Buffer.from(value, "base64").toString("utf8");
  return createPrivateKey(pem);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** JWT RS256 richiesto da ogni chiamata: `kid` = id dell'applicazione, audience e issuer fissi. */
export function buildJwt(appId: string, key: KeyObject, nowSeconds: number, ttlSeconds = JWT_TTL_SECONDS): string {
  const header = base64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId }));
  const payload = base64url(
    JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: nowSeconds, exp: nowSeconds + ttlSeconds })
  );
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), key);
  return `${header}.${payload}.${base64url(signature)}`;
}

let cachedJwt: { token: string; expiresAt: number } | null = null;

/** Svuota la cache del JWT (solo per i test). */
export function resetJwtCacheForTests(): void {
  cachedJwt = null;
}

function currentJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt - JWT_RENEW_MARGIN_SECONDS > now) return cachedJwt.token;
  const appId = process.env.ENABLE_BANKING_APP_ID?.trim();
  const rawKey = process.env.ENABLE_BANKING_PRIVATE_KEY;
  if (!appId || !rawKey?.trim()) {
    throw new Error("ENABLE_BANKING_APP_ID/ENABLE_BANKING_PRIVATE_KEY non definite.");
  }
  const token = buildJwt(appId, parsePrivateKey(rawKey), now);
  cachedJwt = { token, expiresAt: now + JWT_TTL_SECONDS };
  return token;
}

/** Legge il solo codice d'errore dal body: il resto (messaggio, dettaglio) può contenere dati e non si conserva. */
async function errorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && /^[A-Z_]{3,64}$/.test(body.error) ? body.error : null;
  } catch {
    return null;
  }
}

async function request<T>(endpoint: EnableBankingEndpoint, path: string, init: RequestInit = {}): Promise<T> {
  const token = currentJwt();
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch (error) {
    recordBankApiRequest("enablebanking", endpoint, 0);
    throw error;
  }
  recordBankApiRequest("enablebanking", endpoint, response.status);
  if (!response.ok) throw new EnableBankingError(endpoint, response.status, await errorCode(response));
  return (await response.json()) as T;
}

/** Valida che un id esterno (sessione/conto) non contenga separatori di path prima di finire in un URL. */
function assertSafePathSegment(value: string): void {
  if (!/^[A-Za-z0-9-]{1,128}$/.test(value)) {
    throw new Error("Valore non valido per un segmento di path Enable Banking");
  }
}

/** Banca (ASPSP) come la restituisce `GET /aspsps`. */
export interface Aspsp {
  name: string;
  country: string;
  logo?: string;
  bic?: string;
  /** Durata massima del consenso in secondi. */
  maximum_consent_validity?: number;
  psu_types?: string[];
  beta?: boolean;
}

/** Banche disponibili in un paese per conti personali (servizio AIS). */
export async function listAspsps(country: string): Promise<Aspsp[]> {
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error(`Codice paese non valido (atteso ISO 3166-1 alpha-2): ${country}`);
  }
  const { aspsps } = await request<{ aspsps: Aspsp[] }>(
    "aspsps.list",
    `/aspsps?country=${encodeURIComponent(country)}&psu_type=personal&service=AIS`
  );
  return aspsps;
}

/** Avvia l'autorizzazione: restituisce l'URL della banca. `state` torna identico nella callback. */
export async function startAuthorization(params: {
  aspsp: { name: string; country: string };
  validUntil: Date;
  redirectUrl: string;
  state: string;
  language: string;
}): Promise<{ url: string; authorization_id: string }> {
  return request("auth.start", "/auth", {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: params.validUntil.toISOString() },
      aspsp: params.aspsp,
      state: params.state,
      redirect_url: params.redirectUrl,
      psu_type: "personal",
      language: params.language,
    }),
  });
}

/** Conto come lo descrive Enable Banking (`AccountResource`): `uid` è l'id da usare nelle chiamate. */
export interface EnableBankingAccount {
  uid?: string;
  account_id?: { iban?: string; other?: { identification?: string } };
  name?: string;
  product?: string;
  currency?: string;
  identification_hash?: string;
}

export interface CreatedSession {
  session_id: string;
  accounts: EnableBankingAccount[];
  access: { valid_until: string };
}

/** Scambia il `code` della callback con una sessione autorizzata (conti e scadenza del consenso). */
export async function createSession(code: string): Promise<CreatedSession> {
  return request("sessions.create", "/sessions", { method: "POST", body: JSON.stringify({ code }) });
}

export type SessionStatus =
  | "AUTHORIZED"
  | "CANCELLED"
  | "CLOSED"
  | "EXPIRED"
  | "INVALID"
  | "PENDING_AUTHORIZATION"
  | "RETURNED_FROM_BANK"
  | "REVOKED";

export interface SessionInfo {
  status: SessionStatus;
  accounts: string[];
  access?: { valid_until?: string };
}

/** Stato di una sessione e uid dei conti autorizzati. */
export async function getSession(sessionId: string): Promise<SessionInfo> {
  assertSafePathSegment(sessionId);
  return request("sessions.get", `/sessions/${encodeURIComponent(sessionId)}`);
}

/** Chiude la sessione: Enable Banking revoca il consenso. Una sessione già chiusa, scaduta o sparita conta come chiusa. */
export async function deleteSession(sessionId: string): Promise<void> {
  assertSafePathSegment(sessionId);
  try {
    await request<unknown>("sessions.delete", `/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof EnableBankingError && (error.reason === "expired" || error.reason === "not_found")) return;
    throw error;
  }
}

/** Dettagli di un conto (nome, IBAN, prodotto). */
export async function getAccountDetails(uid: string): Promise<EnableBankingAccount> {
  assertSafePathSegment(uid);
  return request("accounts.details", `/accounts/${encodeURIComponent(uid)}/details`);
}

export interface EnableBankingBalance {
  balance_amount: { amount: string; currency: string };
  balance_type: string;
}

/** Saldi di un conto (più tipi ISO 20022: disponibile, contabile, …). */
export async function getAccountBalances(uid: string): Promise<EnableBankingBalance[]> {
  assertSafePathSegment(uid);
  const { balances } = await request<{ balances: EnableBankingBalance[] }>(
    "accounts.balances",
    `/accounts/${encodeURIComponent(uid)}/balances`
  );
  return balances;
}

export interface EnableBankingTransaction {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator?: "CRDT" | "DBIT";
  status?: string;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  creditor?: { name?: string | null } | null;
  debtor?: { name?: string | null } | null;
  remittance_information?: string[] | null;
  merchant_category_code?: string | null;
}

/**
 * Movimenti contabilizzati (`BOOK`) di un conto, tutte le pagine. Con `dateFrom` null si chiede lo storico più lungo
 * (strategia `longest`): molte banche danno più di 90 giorni solo subito dopo il consenso.
 */
export async function getAccountTransactions(uid: string, dateFrom: string | null): Promise<EnableBankingTransaction[]> {
  assertSafePathSegment(uid);
  const all: EnableBankingTransaction[] = [];
  let continuationKey: string | null = null;
  for (let page = 0; page < TRANSACTIONS_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ transaction_status: "BOOK" });
    if (dateFrom) params.set("date_from", dateFrom);
    else params.set("strategy", "longest");
    if (continuationKey) params.set("continuation_key", continuationKey);
    const data: { transactions: EnableBankingTransaction[]; continuation_key?: string | null } = await request(
      "accounts.transactions",
      `/accounts/${encodeURIComponent(uid)}/transactions?${params.toString()}`
    );
    all.push(...data.transactions);
    continuationKey = data.continuation_key ?? null;
    if (!continuationKey) return all;
  }
  throw new Error(`Movimenti Enable Banking oltre ${TRANSACTIONS_MAX_PAGES} pagine: interrotto per sicurezza`);
}
