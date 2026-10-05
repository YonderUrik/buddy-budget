/**
 * Logo di uno strumento dal servizio Logo.dev, scaricato dal server e conservato su Redis: il browser dell'utente non
 * parla mai con terzi, e ogni logo si chiede una volta ogni `LOGO_TTL_SECONDS`. I fondi si cercano per emittente
 * (poche decine di richieste in tutto), le azioni per ISIN.
 */

import type { LogoSource } from "./logo-source";

/** Un logo trovato si ricontrolla dopo un mese, uno assente dopo tre giorni (il catalogo del servizio cresce). */
export const LOGO_TTL_SECONDS = 30 * 24 * 60 * 60;
export const LOGO_MISS_TTL_SECONDS = 3 * 24 * 60 * 60;
/** Dopo un errore del servizio non lo si richiama per qualche minuto: niente raffica per ogni riga della tabella. */
export const LOGO_ERROR_COOLDOWN_SECONDS = 5 * 60;
/** Lato del logo richiesto (px): le icone sono 36 px, 128 reggono gli schermi ad alta densità. */
export const LOGO_SIZE_PX = 128;
export const LOGO_REQUEST_TIMEOUT_MS = 5_000;
/** Un logo più grande di così non è un logo: lo si scarta invece di riempire Redis. */
export const LOGO_MAX_BYTES = 100 * 1024;

const LOGO_BASE_URL = "https://img.logo.dev";

/** Voce in cache: il file in base64, oppure `null` se il servizio non ha il logo. */
export type CachedLogo = { contentType: string; data: string } | null;

export interface LogoStore {
  /** `undefined` = non in cache, `null` = in cache come assente. */
  get(key: string): Promise<CachedLogo | undefined>;
  set(key: string, value: CachedLogo, ttlSeconds: number): Promise<void>;
  isCoolingDown(): Promise<boolean>;
  markCoolingDown(ttlSeconds: number): Promise<void>;
}

export interface LogoLookupDeps {
  /** Chiave pubblica (`pk_…`) del servizio; senza, il servizio è spento. */
  token: string | undefined;
  store: LogoStore;
  fetchFn?: typeof fetch;
}

/** `hit`: logo trovato (da cache o dal servizio); `miss`: il servizio non ce l'ha; `error`: servizio o rete in errore; `disabled`: senza chiave. */
export type LogoOutcome = "hit" | "miss" | "error" | "disabled";

export interface LogoLookupResult {
  outcome: LogoOutcome;
  logo?: { contentType: string; bytes: Buffer };
  /** True se la risposta viene dalla cache e non da una chiamata al servizio. */
  cached: boolean;
}

/** URL del logo sul servizio. `fallback=404` evita il monogramma grigio con HTTP 200 quando il logo manca. */
export function buildLogoUrl(source: LogoSource, token: string): string {
  const path = source.kind === "isin" ? `isin/${encodeURIComponent(source.isin)}` : encodeURIComponent(source.domain);
  const params = new URLSearchParams({ token, size: String(LOGO_SIZE_PX), format: "webp", fallback: "404" });
  return `${LOGO_BASE_URL}/${path}?${params.toString()}`;
}

function toResult(cached: CachedLogo, fromCache: boolean): LogoLookupResult {
  return cached
    ? { outcome: "hit", logo: { contentType: cached.contentType, bytes: Buffer.from(cached.data, "base64") }, cached: fromCache }
    : { outcome: "miss", cached: fromCache };
}

/** Cerca il logo in cache, poi sul servizio. Non lancia mai: un guasto è l'esito `error`. */
export async function lookupLogo(source: LogoSource, deps: LogoLookupDeps): Promise<LogoLookupResult> {
  if (!deps.token) return { outcome: "disabled", cached: false };
  try {
    const hit = await deps.store.get(source.key);
    if (hit !== undefined) return toResult(hit, true);
    if (await deps.store.isCoolingDown()) return { outcome: "error", cached: true };

    const response = await (deps.fetchFn ?? fetch)(buildLogoUrl(source, deps.token), {
      signal: AbortSignal.timeout(LOGO_REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) {
      await deps.store.set(source.key, null, LOGO_MISS_TTL_SECONDS);
      return { outcome: "miss", cached: false };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) {
      await deps.store.markCoolingDown(LOGO_ERROR_COOLDOWN_SECONDS);
      return { outcome: "error", cached: false };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) {
      await deps.store.set(source.key, null, LOGO_MISS_TTL_SECONDS);
      return { outcome: "miss", cached: false };
    }
    await deps.store.set(source.key, { contentType, data: bytes.toString("base64") }, LOGO_TTL_SECONDS);
    return { outcome: "hit", logo: { contentType, bytes }, cached: false };
  } catch {
    return { outcome: "error", cached: false };
  }
}
