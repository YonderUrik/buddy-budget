import "server-only";
import { getLocaleProfile } from "./server";
import { translateServerMessage } from "./messages";

/**
 * Translates the `error` message of a JSON error response (status >= 400) into the language of the request, so every
 * route can keep returning its Italian source text. Unknown texts (codes, dynamic messages) are left unchanged.
 */
export async function translateErrorResponse(response: Response): Promise<Response> {
  if (response.status < 400 || !response.headers.get("content-type")?.includes("application/json")) return response;
  const { language } = await getLocaleProfile();
  if (language === "it") return response;
  const body: unknown = await response.clone().json().catch(() => null);
  if (!body || typeof body !== "object" || !("error" in body) || typeof body.error !== "string") return response;
  const error = translateServerMessage(language, body.error);
  if (error === body.error) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify({ ...body, error }), { status: response.status, statusText: response.statusText, headers });
}
