import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { findBenchmarkSuggestion } from "@/lib/investments/benchmark-suggestions";
import { lookupLogo } from "@/lib/investments/logos/logo-service";
import { redisLogoStore } from "@/lib/investments/logos/redis-logo-store";
import { bindRequestUser, recordLogoRequest, requestLogger, withRoute } from "@/lib/observability";

const LOGO_CACHE_CONTROL = "private, max-age=86400";
const NO_LOGO_CACHE_CONTROL = "private, max-age=3600";

/**
 * Logo of a common index offered in «Confronta con un indice» (the index provider's mark), served by our server through
 * the same Logo.dev cache as the instruments. Only the fixed list of suggestions: the route is never a proxy for any
 * domain. 404 when there is none: the client keeps the monogram.
 */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id } = await params;
  const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": NO_LOGO_CACHE_CONTROL } });
  const suggestion = findBenchmarkSuggestion(id);
  if (!suggestion) return notFound();

  const source = { kind: "issuer", domain: suggestion.logoDomain, key: `issuer:${suggestion.logoDomain}` } as const;
  const result = await lookupLogo(source, { token: process.env.LOGODEV_PUBLISHABLE_KEY, store: redisLogoStore });
  if (!result.cached && result.outcome !== "disabled") {
    recordLogoRequest(source.kind, result.outcome);
    const log = requestLogger();
    if (result.outcome === "error") log.warn("benchmark.logo.failed", { provider: "logodev" });
    else log.info(result.outcome === "hit" ? "benchmark.logo.fetched" : "benchmark.logo.missing", { provider: "logodev" });
  }
  if (!result.logo) return notFound();
  return new Response(new Uint8Array(result.logo.bytes), {
    headers: { "Content-Type": result.logo.contentType, "Cache-Control": LOGO_CACHE_CONTROL },
  });
}

export const GET = withRoute("benchmarks.logo", handleGet);
