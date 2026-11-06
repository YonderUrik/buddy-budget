import { createHash } from "node:crypto";
import { looksLikeIbkrFlex } from "@/lib/investments/import/ibkr-flex";
import { childNamed, parseXml } from "./xml";
import { acquireSendRequestSlot, RateLimitExceededError, type RateWindowStore } from "./rate-limit";

/**
 * Read-only client for IBKR's Flex Web Service (v3): `SendRequest` asks IBKR to generate the report of a saved Flex
 * Query, `GetStatement` downloads it once generated. Only a token and a query id are used: never a username or
 * password, never trading endpoints. The token travels only in the query string IBKR requires; URLs, tokens and
 * response bodies never reach errors or logs (errors carry a closed `reason` and IBKR's numeric code).
 */

export const IBKR_FLEX_BASE_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService";
const VERSION = "3";
/** IBKR refuses clients without a User-Agent; a generic product name, never user data. */
const USER_AGENT = "BuddyBudget-FlexClient/1.0";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_CHARS = 25 * 1024 * 1024;
const SEND_ATTEMPTS = 4;
/** Polling of a report being generated: first wait, cap of a single wait and overall deadline. */
const POLL_FIRST_MS = 2_000;
const POLL_MAX_WAIT_MS = 15_000;
const POLL_DEADLINE_MS = 180_000;

export type IbkrFlexErrorReason =
  | "token_expired" | "token_invalid" | "query_invalid" | "ip_restricted" | "account_inactive"
  | "rate_limited" | "unavailable" | "timeout" | "invalid_response" | "too_large";

/** Reasons that need the user (new token, fixed query): automatic syncs stop until they reconnect. */
export const CREDENTIAL_REASONS: ReadonlySet<IbkrFlexErrorReason> = new Set(["token_expired", "token_invalid", "query_invalid", "ip_restricted", "account_inactive"]);

export class IbkrFlexError extends Error {
  constructor(public readonly reason: IbkrFlexErrorReason, public readonly code: number | null = null) {
    super(`IBKR Flex ${reason}${code ? ` (${code})` : ""}`);
    this.name = "IbkrFlexError";
  }
  get retryable(): boolean { return ["rate_limited", "unavailable", "timeout"].includes(this.reason); }
}

/** IBKR Flex Web Service error codes; 1019 (generation in progress) is handled by polling. */
const CODE_REASONS: Record<number, IbkrFlexErrorReason> = {
  1001: "unavailable", 1003: "unavailable", 1004: "unavailable", 1005: "unavailable", 1006: "unavailable", 1007: "unavailable", 1008: "unavailable",
  1009: "unavailable", 1010: "query_invalid", 1011: "account_inactive", 1012: "token_expired", 1013: "ip_restricted", 1014: "query_invalid",
  1015: "token_invalid", 1016: "account_inactive", 1017: "invalid_response", 1018: "rate_limited", 1020: "token_invalid", 1021: "unavailable",
};
export const IN_PROGRESS_CODE = 1019;

export interface IbkrFlexCredentials { token: string; queryId: string }
export interface IbkrFlexClientDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Shared counters for IBKR's SendRequest limits (Redis in production). */
  rateStore: RateWindowStore;
  baseUrl?: string;
}
/** Optional period override (`fd`/`td`, yyyyMMdd); without it IBKR uses the period saved in the query. */
export interface IbkrFlexPeriod { from: string; to: string }

/** A hash of the token, used as rate-limit scope: two connections with one token share IBKR's limit. */
export function tokenScope(token: string): string {
  return createHash("sha256").update(`ibkr-flex:${token}`).digest("hex").slice(0, 24);
}

const compact = (date: string) => date.replaceAll("-", "");
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Exponential backoff with ±20% jitter. */
export function backoffMs(attempt: number, baseMs = 2_000, capMs = 30_000): number {
  const exact = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.round(exact * (0.8 + Math.random() * 0.4));
}

type Envelope = { status: "success"; referenceCode: string } | { status: "fail"; code: number | null } | { status: "report"; xml: string };

/** Parse a Flex Web Service reply: a `FlexStatementResponse` envelope, or the report itself. */
export function readEnvelope(text: string): Envelope {
  if (looksLikeIbkrFlex(text)) return { status: "report", xml: text };
  let root;
  try { root = parseXml(text); } catch { throw new IbkrFlexError("invalid_response"); }
  if (root.name !== "FlexStatementResponse") throw new IbkrFlexError("invalid_response");
  const status = childNamed(root, "Status")?.text ?? "";
  const raw = childNamed(root, "ErrorCode")?.text ?? "";
  const code = /^\d{4}$/.test(raw) ? Number(raw) : null;
  if (/^success$/i.test(status)) {
    const referenceCode = childNamed(root, "ReferenceCode")?.text ?? "";
    if (!/^\d{1,30}$/.test(referenceCode)) throw new IbkrFlexError("invalid_response");
    return { status: "success", referenceCode };
  }
  if (/^(fail|warn)$/i.test(status)) return { status: "fail", code };
  throw new IbkrFlexError("invalid_response");
}

function errorFor(code: number | null): IbkrFlexError {
  return new IbkrFlexError(code !== null ? CODE_REASONS[code] ?? "unavailable" : "invalid_response", code);
}

/** One GET with a timeout and a size cap; network failures become `timeout`/`unavailable`, never the URL. */
async function get(url: URL, deps: IbkrFlexClientDeps): Promise<string> {
  let response: Response | undefined;
  let target = url;
  // At most one redirect, and only to an IBKR host: the token is in the query string and must not go elsewhere.
  for (let hop = 0; hop < 2; hop++) {
    try {
      response = await (deps.fetch ?? fetch)(target, { headers: { "User-Agent": USER_AGENT, Accept: "application/xml, text/xml" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store", redirect: "manual" });
    } catch (error) {
      throw new IbkrFlexError(error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "unavailable");
    }
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    const next = location ? new URL(location, target) : null;
    if (!next || next.protocol !== "https:" || !/(^|\.)interactivebrokers\.com$/.test(next.hostname) || hop === 1) throw new IbkrFlexError("invalid_response");
    target = next;
  }
  if (!response) throw new IbkrFlexError("unavailable");
  if (response.status === 429) throw new IbkrFlexError("rate_limited");
  if (!response.ok) throw new IbkrFlexError(response.status >= 500 ? "unavailable" : "invalid_response");
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_RESPONSE_CHARS) throw new IbkrFlexError("too_large");
  let text: string;
  try { text = await response.text(); } catch { throw new IbkrFlexError("unavailable"); }
  if (text.length > MAX_RESPONSE_CHARS) throw new IbkrFlexError("too_large");
  return text;
}

/** `SendRequest`: asks IBKR to generate the report, within the shared rate limit, retrying transient failures. */
export async function sendFlexRequest(credentials: IbkrFlexCredentials, period: IbkrFlexPeriod | null, deps: IbkrFlexClientDeps): Promise<string> {
  const sleep = deps.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      try { await acquireSendRequestSlot(tokenScope(credentials.token), { store: deps.rateStore, now: deps.now, sleep }); }
      catch (error) { if (error instanceof RateLimitExceededError) throw new IbkrFlexError("rate_limited"); throw error; }
      const url = new URL(`${deps.baseUrl ?? IBKR_FLEX_BASE_URL}/SendRequest`);
      url.searchParams.set("t", credentials.token);
      url.searchParams.set("q", credentials.queryId);
      url.searchParams.set("v", VERSION);
      if (period) { url.searchParams.set("fd", compact(period.from)); url.searchParams.set("td", compact(period.to)); }
      const envelope = readEnvelope(await get(url, deps));
      if (envelope.status === "success") return envelope.referenceCode;
      if (envelope.status === "report") throw new IbkrFlexError("invalid_response");
      throw errorFor(envelope.code);
    } catch (error) {
      if (!(error instanceof IbkrFlexError) || !error.retryable || attempt + 1 >= SEND_ATTEMPTS) throw error;
      await sleep(backoffMs(attempt));
    }
  }
}

/** `GetStatement`: polls while IBKR is still generating (1019), with bounded backoff, and returns the report XML. */
export async function getFlexStatement(credentials: IbkrFlexCredentials, referenceCode: string, deps: IbkrFlexClientDeps): Promise<string> {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const deadline = now() + POLL_DEADLINE_MS;
  let wait = POLL_FIRST_MS;
  let last: IbkrFlexError = new IbkrFlexError("timeout");
  for (let attempt = 0; ; attempt++) {
    await sleep(wait);
    try {
      const url = new URL(`${deps.baseUrl ?? IBKR_FLEX_BASE_URL}/GetStatement`);
      url.searchParams.set("t", credentials.token);
      url.searchParams.set("q", referenceCode);
      url.searchParams.set("v", VERSION);
      const envelope = readEnvelope(await get(url, deps));
      if (envelope.status === "report") return envelope.xml;
      if (envelope.status === "success") throw new IbkrFlexError("invalid_response");
      if (envelope.code !== IN_PROGRESS_CODE) throw errorFor(envelope.code);
      last = new IbkrFlexError("timeout", IN_PROGRESS_CODE);
    } catch (error) {
      if (!(error instanceof IbkrFlexError) || !error.retryable) throw error;
      last = error;
    }
    wait = Math.min(POLL_MAX_WAIT_MS, backoffMs(attempt, POLL_FIRST_MS, POLL_MAX_WAIT_MS));
    if (now() + wait > deadline) throw last.reason === "timeout" || last.reason === "unavailable" ? last : new IbkrFlexError("timeout");
  }
}

/** Generate and download one report. */
export async function fetchFlexReport(credentials: IbkrFlexCredentials, period: IbkrFlexPeriod | null, deps: IbkrFlexClientDeps): Promise<string> {
  const referenceCode = await sendFlexRequest(credentials, period, deps);
  return getFlexStatement(credentials, referenceCode, deps);
}
