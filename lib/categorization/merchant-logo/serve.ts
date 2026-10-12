import "server-only";
import { lookupLogo } from "@/lib/investments/logos/logo-service";
import { redisLogoStore } from "@/lib/investments/logos/redis-logo-store";
import { recordLogoRequest, requestLogger } from "@/lib/observability";

/** Quanto il browser tiene il logo prima di richiederlo (un giorno); l'assenza si ricontrolla più spesso. */
const LOGO_CACHE_CONTROL = "private, max-age=86400";
const NO_LOGO_CACHE_CONTROL = "private, max-age=3600";

/** 404 senza logo: il client resta sull'iniziale. */
export function merchantLogoNotFound(): Response {
  return new Response(null, { status: 404, headers: { "Cache-Control": NO_LOGO_CACHE_CONTROL } });
}

/**
 * Risposta con il logo di un dominio, dalla cache Redis o da Logo.dev (stessa cache e stessi limiti dei loghi degli
 * strumenti). Registra metrica e log solo quando il servizio è stato davvero interrogato.
 */
export async function serveMerchantLogo(domain: string): Promise<Response> {
  const result = await lookupLogo(
    { kind: "merchant", domain, key: `merchant:${domain}` },
    { token: process.env.LOGODEV_PUBLISHABLE_KEY, store: redisLogoStore }
  );
  if (!result.cached && result.outcome !== "disabled") {
    recordLogoRequest("merchant", result.outcome);
    const log = requestLogger();
    if (result.outcome === "error") log.warn("merchant.logo.failed", { provider: "logodev" });
    else log.info(result.outcome === "hit" ? "merchant.logo.fetched" : "merchant.logo.missing", { provider: "logodev" });
  }
  if (!result.logo) return merchantLogoNotFound();
  return new Response(new Uint8Array(result.logo.bytes), {
    headers: { "Content-Type": result.logo.contentType, "Cache-Control": LOGO_CACHE_CONTROL },
  });
}
