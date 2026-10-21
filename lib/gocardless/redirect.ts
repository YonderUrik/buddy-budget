import { getAppUrl } from "@/lib/env";

/** Who started a bank connection: the web app (cookie session) or a native app (bearer token, system browser). */
export type BankLinkClient = "web" | "native";

/** Path of the web return (needs the browser's session cookie). */
export const WEB_CALLBACK_PATH = "/api/gocardless/callback";
/** Path of the native return: public, it never reads a session nor changes state, it only hands the browser back to the app. */
export const NATIVE_CALLBACK_PATH = "/api/gocardless/callback/native";
/** Custom-scheme address the native apps capture (`ASWebAuthenticationSession` callback scheme, Android intent filter). */
export const NATIVE_RETURN_URL = "buddybudget://bank/return";
/** HTTPS page that deep-links to the app: target for Universal/App Links, and a manual fallback when the scheme is blocked. */
export const NATIVE_RETURN_PAGE_PATH = "/banca/ritorno";

/**
 * URL GoCardless sends the browser back to after consent (it appends `ref=<reference>`, plus `error`/`details` when
 * the user cancels or the bank fails). Stored on every requisition: the cleanup uses it to recognize ours.
 */
export function gocardlessRedirectUrl(client: BankLinkClient = "web"): string {
  return `${getAppUrl()}${client === "native" ? NATIVE_CALLBACK_PATH : WEB_CALLBACK_PATH}`;
}

/**
 * Outcome the native return reports to the app. Informational only: the app always calls
 * `POST /api/gocardless/connections/{ref}/complete`, which asks GoCardless for the real state.
 * - `returned`: the bank sent the user back without an error;
 * - `cancelled`: the user cancelled at GoCardless or at the bank;
 * - `failed`: GoCardless or the bank reported another error (its code is passed on as `error`);
 * - `invalid_ref`: the address has no usable reference (nothing to complete).
 */
export const NATIVE_RETURN_STATUSES = ["returned", "cancelled", "failed", "invalid_ref"] as const;
export type NativeReturnStatus = (typeof NATIVE_RETURN_STATUSES)[number];

export interface NativeReturn {
  ref: string | null;
  status: NativeReturnStatus;
  /** GoCardless error code (e.g. `UserCancelledSession`), sanitized; null when none. */
  error: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** GoCardless codes are identifiers: anything else (or longer) is dropped rather than echoed into the app. */
const ERROR_CODE = /^[A-Za-z0-9_.-]{1,64}$/;
const CANCELLED_ERRORS = new Set(["UserCancelledSession"]);

/** Reads the query GoCardless appends to the redirect (`ref`, `error`) into the outcome sent to the app. */
export function parseNativeReturn(params: URLSearchParams): NativeReturn {
  const rawRef = params.get("ref");
  const ref = rawRef && UUID.test(rawRef) ? rawRef.toLowerCase() : null;
  const rawError = params.get("error");
  const error = rawError && ERROR_CODE.test(rawError) ? rawError : rawError ? "unknown" : null;
  if (!ref) return { ref: null, status: "invalid_ref", error };
  if (!rawError) return { ref, status: "returned", error: null };
  return { ref, status: CANCELLED_ERRORS.has(rawError) ? "cancelled" : "failed", error };
}

/** Normalizes the query of the fallback page (already an outcome, e.g. from a Universal Link) the same way. */
export function parseNativeReturnPage(params: URLSearchParams): NativeReturn {
  const rawRef = params.get("ref");
  const ref = rawRef && UUID.test(rawRef) ? rawRef.toLowerCase() : null;
  const status = params.get("status");
  const rawError = params.get("error");
  const error = rawError && ERROR_CODE.test(rawError) ? rawError : null;
  if (!ref) return { ref: null, status: "invalid_ref", error };
  return { ref, status: NATIVE_RETURN_STATUSES.includes(status as NativeReturnStatus) ? (status as NativeReturnStatus) : "returned", error };
}

/** `buddybudget://bank/return?ref=<connectionId>&status=<status>[&error=<code>]` (no `ref` when it was unusable). */
export function nativeReturnUrl(outcome: NativeReturn, base: string = NATIVE_RETURN_URL): string {
  const query = new URLSearchParams();
  if (outcome.ref) query.set("ref", outcome.ref);
  query.set("status", outcome.status);
  if (outcome.error) query.set("error", outcome.error);
  return `${base}?${query.toString()}`;
}
