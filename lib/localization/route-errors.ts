import "server-only";
import { getLocaleProfile } from "./server";
import type { Language } from "./config";
import { messages, translate } from "./messages";

let patterns: { regex: RegExp; source: string; keys: string[] }[] | null = null;

/** Catalog keys with `{0}`-style values as regular expressions, built once on the first error. */
function placeholderPatterns() {
  patterns ??= Object.keys(messages).filter((source) => /\{\w+\}/.test(source)).map((source) => {
    const keys: string[] = [];
    const body = source.split(/(\{\w+\})/).map((part) => {
      const key = /^\{(\w+)\}$/.exec(part)?.[1];
      if (key === undefined) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      keys.push(key);
      return "(.+?)";
    }).join("");
    return { regex: new RegExp(`^${body}$`), source, keys };
  });
  return patterns;
}

/** A server message in `language`: exact catalog match first, then a key whose `{0}` values fill the message. */
export function translateServerMessage(language: Language, message: string): string {
  const exact = translate(language, message);
  if (exact !== message || language === "it") return exact;
  for (const { regex, source, keys } of placeholderPatterns()) {
    const match = regex.exec(message);
    if (match) return translate(language, source, Object.fromEntries(keys.map((key, index) => [key, match[index + 1]])));
  }
  return message;
}

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
