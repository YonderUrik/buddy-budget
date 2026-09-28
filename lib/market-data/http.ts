import { errorForStatus, ProviderError } from "./errors";
import type { ProviderContext } from "./types";

/** Timeout di una singola chiamata a una fonte esterna. */
export const PROVIDER_TIMEOUT_MS = 15_000;

/** User-Agent da browser: alcune fonti rifiutano le richieste senza. */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

/**
 * GET verso una fonte. Converte gli stati HTTP negli errori tipizzati; `notFoundAsNull` fa restituire null su 404
 * (strumento sconosciuto alla fonte = risposta vuota, non un guasto). Il messaggio d'errore non contiene mai l'URL,
 * che può portare chiavi.
 */
export async function providerGet(
  provider: string,
  url: string,
  ctx: ProviderContext,
  options: { headers?: Record<string, string>; notFoundAsNull?: boolean } = {}
): Promise<Response | null> {
  let response: Response;
  try {
    response = await ctx.fetch(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT, ...options.headers },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProviderError(provider, error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network");
  }
  if (response.status === 404 && options.notFoundAsNull) return null;
  if (!response.ok) throw errorForStatus(provider, response.status);
  return response;
}

/** Header `Cookie` con i cookie impostati da una risposta (solo nome=valore, senza attributi). */
export function setCookieHeader(response: Response): string {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

/** Legge il body come JSON; un body non JSON (pagina HTML di un firewall) è un blocco. */
export async function readJson<T>(provider: string, response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const looksLikeHtml = /^\s*</.test(text);
    throw new ProviderError(provider, looksLikeHtml ? "html instead of json" : "invalid json", response.status);
  }
}

/** Secondi Unix a mezzanotte UTC della data YYYY-MM-DD. */
export function toUnixSeconds(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 1000);
}

/** Data YYYY-MM-DD (UTC) di un istante in millisecondi. */
export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
