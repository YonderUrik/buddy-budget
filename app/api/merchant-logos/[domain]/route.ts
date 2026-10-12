import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isKnownMerchantLogoDomain } from "@/lib/categorization/merchant-name";
import { lookupLogo } from "@/lib/investments/logos/logo-service";
import { redisLogoStore } from "@/lib/investments/logos/redis-logo-store";
import { bindRequestUser, recordLogoRequest, requestLogger, withRoute } from "@/lib/observability";

/** Quanto il browser tiene il logo prima di richiederlo (un giorno); l'assenza si ricontrolla più spesso. */
const LOGO_CACHE_CONTROL = "private, max-age=86400";
const NO_LOGO_CACHE_CONTROL = "private, max-age=3600";

/**
 * Logo di un marchio noto del dizionario degli esercenti, servito dai nostri server. Si accetta solo un dominio della
 * lista (`MERCHANT_LOGO_DOMAINS`): a Logo.dev arriva un dominio di un marchio pubblico, mai un dato dell'utente, e il
 * browser non parla con terzi. 404 quando non c'è: il client mostra l'iniziale.
 */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { domain } = await params;
  const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": NO_LOGO_CACHE_CONTROL } });
  if (!isKnownMerchantLogoDomain(domain)) return notFound();

  const result = await lookupLogo(
    { kind: "merchant", domain, key: `merchant:${domain}` },
    { token: process.env.LOGODEV_PUBLISHABLE_KEY, store: redisLogoStore }
  );
  // Si conta solo ciò che ha davvero interrogato il servizio: la cache e il servizio spento non sono segnali utili.
  if (!result.cached && result.outcome !== "disabled") {
    recordLogoRequest("merchant", result.outcome);
    const log = requestLogger();
    if (result.outcome === "error") log.warn("merchant.logo.failed", { provider: "logodev" });
    else log.info(result.outcome === "hit" ? "merchant.logo.fetched" : "merchant.logo.missing", { provider: "logodev" });
  }
  if (!result.logo) return notFound();
  return new Response(new Uint8Array(result.logo.bytes), {
    headers: { "Content-Type": result.logo.contentType, "Cache-Control": LOGO_CACHE_CONTROL },
  });
}

export const GET = withRoute("merchant_logos.get", handleGet);
