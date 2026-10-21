import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { detectLanguage, isSupportedProfile, LANGUAGES, resolveProfile, type Language, type LocaleProfile, type ProductCountry } from "@/lib/localization/config";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { buildAppMeta } from "@/lib/views";

/** How long a signed-out answer may be cached: it changes only with a release. */
const META_MAX_AGE_SECONDS = 3600;

/**
 * GET /api/meta?language=&country= — public app metadata for the native apps (gaps.md G13): countries with languages,
 * features, sections and planning switches, currencies, home pages, notification defaults, limits, the feature catalog,
 * legal metadata and the server build. With a session the labels follow the user's language and `profile` carries
 * their capabilities and the onboarding category proposal; before sign-in `country` + `language` (a valid pair) ask
 * for a profile, e.g. during onboarding.
 */
async function handleGet(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (session) bindRequestUser(session.user.id);
  const requestedLanguage = params.get("language");
  if (requestedLanguage !== null && !LANGUAGES.includes(requestedLanguage as Language)) {
    return apiError(400, "validation_failed", "language deve essere uno tra it, en, de", { field: "language" });
  }
  const requestedCountry = params.get("country");
  let profile: LocaleProfile | null = session ? resolveProfile(session.user) : null;
  if (!profile && requestedCountry !== null) {
    const language = (requestedLanguage as Language | null) ?? detectLanguage(request.headers.get("accept-language"));
    if (!isSupportedProfile(requestedCountry, language)) return apiError(400, "validation_failed", "country e language non sono una coppia valida", { field: "country" });
    profile = { productCountry: requestedCountry as ProductCountry, language };
  }
  const language = profile?.language ?? (requestedLanguage as Language | null) ?? detectLanguage(request.headers.get("accept-language"));
  return Response.json(buildAppMeta({ language, profile }), {
    headers: session ? { "Cache-Control": "private, no-cache" } : { "Cache-Control": `public, max-age=${META_MAX_AGE_SECONDS}`, Vary: "Accept-Language" },
  });
}

export const GET = withRoute("meta.get", handleGet);
