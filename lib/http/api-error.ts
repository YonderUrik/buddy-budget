import type { ZodError } from "zod";

/**
 * Stable machine-readable codes of API error bodies (`{ error, code }`). Native clients map them to their own strings;
 * `error` stays a human message (Italian source, translated by `withRoute`). Specific codes are set by the routes;
 * `GENERIC_ERROR_CODES` fill the gaps by status. Adding a code is fine, renaming or removing one is a breaking change.
 */
export const API_ERROR_CODES = [
  // Generic, by status (see `GENERIC_ERROR_CODES`).
  "bad_request",
  "forbidden",
  "not_found",
  "conflict",
  "unprocessable",
  "too_many_requests",
  "internal_error",
  // Request shape.
  "validation_failed",
  "invalid_date",
  "invalid_date_range",
  "invalid_type",
  "invalid_cursor",
  "invalid_period",
  // Domain.
  "invalid_account",
  "invalid_category",
  "linked_account_read_only",
  "linked_transaction_not_deletable",
  "linked_transaction_field_locked",
  "category_direction_mismatch",
  "invalid_excluded_amount",
  "category_exists",
  "category_in_use",
  "fallback_category_locked",
  "transfer_without_budget",
  "subscription_exists",
  "account_not_found",
  "transaction_not_found",
  "category_not_found",
  "position_not_sellable",
  "country_feature_unavailable",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Code used when a route returns an error without one: by HTTP status. 401 keeps an empty body, like the proxy. */
export const GENERIC_ERROR_CODES: Partial<Record<number, ApiErrorCode>> = {
  400: "bad_request",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  422: "unprocessable",
  429: "too_many_requests",
};

/** Generic code for a status (`internal_error` for 5xx), or null when the status gets none (401, < 400). */
export function genericErrorCode(status: number): ApiErrorCode | null {
  if (status >= 500) return "internal_error";
  return GENERIC_ERROR_CODES[status] ?? (status >= 400 && status !== 401 ? "bad_request" : null);
}

/** JSON error response with a stable `code`, a human `error` message and optional extra fields. */
export function apiError(status: number, code: ApiErrorCode, error: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, code, ...extra }, { status });
}

/** 400 for a failed zod validation: the first issue's message, `validation_failed` and the offending field path. */
export function validationError(error: ZodError): Response {
  const issue = error.issues[0];
  return apiError(400, "validation_failed", issue?.message ?? "Richiesta non valida", { field: issue?.path.join(".") || null });
}

/**
 * Adds the generic `code` to an error response that has none: a JSON body with `error` but no `code` gets one, and
 * an empty body becomes `{ code }`. Other responses are returned unchanged. Used by `withRoute` on every route.
 */
export async function withErrorCode(response: Response): Promise<Response> {
  const code = genericErrorCode(response.status);
  if (!code) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  if (response.body === null) {
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify({ code }), { status: response.status, statusText: response.statusText, headers });
  }
  if (!response.headers.get("content-type")?.includes("application/json")) return response;
  const body: unknown = await response.clone().json().catch(() => null);
  // Only error bodies: a 4xx that answers with its own shape (e.g. `{ status: "already-running" }`) stays as it is.
  if (!body || typeof body !== "object" || Array.isArray(body) || "code" in body || !("error" in body)) return response;
  return new Response(JSON.stringify({ ...body, code }), { status: response.status, statusText: response.statusText, headers });
}
