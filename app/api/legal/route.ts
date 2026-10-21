import { NextRequest } from "next/server";
import { legalMeta, legalMetaSchema } from "@/lib/legal/meta";
import { LANGUAGES, detectLanguage, type Language } from "@/lib/localization/config";
import { withRoute } from "@/lib/observability";

/** How long clients and caches may keep the answer: the version changes only with a new release of the documents. */
const LEGAL_META_MAX_AGE_SECONDS = 3600;

/**
 * Public: current version of Terms and Privacy, the clauses to approve specifically and the document links. The native
 * apps read it before sign-in (onboarding) and while legal-gated. Labels follow `?language=`, else `Accept-Language`.
 */
function handleGet(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("language");
  const language: Language = LANGUAGES.includes(requested as Language) ? (requested as Language) : detectLanguage(request.headers.get("accept-language"));
  return Response.json(legalMetaSchema.parse(legalMeta(language)), {
    headers: { "Cache-Control": `public, max-age=${LEGAL_META_MAX_AGE_SECONDS}`, Vary: "Accept-Language" },
  });
}

export const GET = withRoute("legal.get", handleGet);
