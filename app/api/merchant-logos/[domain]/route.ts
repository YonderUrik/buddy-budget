import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { registrableDomain } from "@/lib/categorization/merchant-logo";
import { merchantLogoNotFound, serveMerchantLogo } from "@/lib/categorization/merchant-logo/serve";
import { verifyMerchantLogoSignature } from "@/lib/categorization/merchant-logo/sign";
import { isKnownMerchantLogoDomain } from "@/lib/categorization/merchant-name";
import { bindRequestUser, withRoute } from "@/lib/observability";

/**
 * Logo di un esercente per dominio, servito dai nostri server: i marchi del dizionario (`MERCHANT_LOGO_DOMAINS`) senza
 * firma, i siti letti nei movimenti con la firma che il server mette nei gruppi (`?s=`). A Logo.dev arriva solo un dominio,
 * mai chi lo ha chiesto, e il browser non parla con terzi. 404 quando non c'è: il client mostra l'iniziale.
 */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { domain } = await params;
  const allowed =
    isKnownMerchantLogoDomain(domain) ||
    (registrableDomain(domain) === domain && verifyMerchantLogoSignature("domain", domain, request.nextUrl.searchParams.get("s")));
  if (!allowed) return merchantLogoNotFound();
  return serveMerchantLogo(domain);
}

export const GET = withRoute("merchant_logos.get", handleGet);
