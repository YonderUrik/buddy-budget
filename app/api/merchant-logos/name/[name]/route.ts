import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { domainOf, nameSearchKey, resolveNameDomain } from "@/lib/categorization/merchant-logo";
import { redisMerchantNameStore } from "@/lib/categorization/merchant-logo/redis-store";
import { merchantLogoNotFound, serveMerchantLogo } from "@/lib/categorization/merchant-logo/serve";
import { verifyMerchantLogoSignature } from "@/lib/categorization/merchant-logo/sign";
import { bindRequestUser, recordLogoRequest, requestLogger, withRoute } from "@/lib/observability";

/** Il nome nel percorso, decodificato una volta (una chiave valida non contiene mai «%»). */
function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Logo di un esercente cercato per nome. Il nome arriva firmato dal server (è il nome di un gruppo di spese dell'utente,
 * mai un bonifico) e si cerca su Logo.dev una volta per tutti, solo se compare nei movimenti di più utenti; il risultato
 * vale solo se il nome trovato è identico. Poi si serve il logo del sito come per gli altri esercenti.
 */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const name = decodeName((await params).name);
  if (nameSearchKey(name) !== name || !verifyMerchantLogoSignature("name", name, request.nextUrl.searchParams.get("s"))) {
    return merchantLogoNotFound();
  }

  const result = await resolveNameDomain(name, { store: redisMerchantNameStore, secretKey: process.env.LOGODEV_SECRET_KEY });
  const log = requestLogger();
  if (result.status === "searched") {
    const { search } = result;
    recordLogoRequest("merchant_search", search.outcome === "found" ? "hit" : search.outcome === "none" ? "miss" : "error");
    if (search.outcome === "error") log.warn("merchant.logo.search_failed", { provider: "logodev", status: search.status });
    else log.info(search.outcome === "found" ? "merchant.logo.search_found" : "merchant.logo.search_missing", { provider: "logodev" });
  } else if (result.status === "skipped" && result.reason === "budget") {
    recordLogoRequest("merchant_search", "skipped");
    log.warn("merchant.logo.search_skipped", { provider: "logodev", reason: result.reason });
  }

  const domain = domainOf(result);
  return domain ? serveMerchantLogo(domain) : merchantLogoNotFound();
}

export const GET = withRoute("merchant_logos.by_name", handleGet);
