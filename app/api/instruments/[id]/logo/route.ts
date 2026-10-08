import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { lookupLogo } from "@/lib/investments/logos/logo-service";
import { logoSourceFor } from "@/lib/investments/logos/logo-source";
import { redisLogoStore } from "@/lib/investments/logos/redis-logo-store";
import { bindRequestUser, recordLogoRequest, requestLogger, withRoute } from "@/lib/observability";

/** Quanto il browser tiene il logo prima di richiederlo (un giorno); l'assenza si ricontrolla più spesso. */
const LOGO_CACHE_CONTROL = "private, max-age=86400";
const NO_LOGO_CACHE_CONTROL = "private, max-age=3600";

/**
 * Logo di uno strumento (ETF/fondi per emittente, azioni per ISIN) servito dai nostri server. 404 quando non c'è:
 * il client ricade sull'icona locale. Il servizio esterno non vede mai l'utente, solo il server.
 */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id } = await params;
  const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": NO_LOGO_CACHE_CONTROL } });

  const instrument = await findVisibleInstrument(session.user.id, id);
  if (!instrument) return notFound();
  const source = logoSourceFor(instrument);
  if (!source) return notFound();

  const result = await lookupLogo(source, { token: process.env.LOGODEV_PUBLISHABLE_KEY, store: redisLogoStore });
  // Si conta solo ciò che ha davvero interrogato il servizio: la cache e il servizio spento non sono segnali utili.
  if (!result.cached && result.outcome !== "disabled") {
    recordLogoRequest(source.kind, result.outcome);
    const log = requestLogger();
    if (result.outcome === "error") log.warn("instrument.logo.failed", { provider: "logodev", reason: source.kind });
    else log.info(result.outcome === "hit" ? "instrument.logo.fetched" : "instrument.logo.missing", { provider: "logodev", reason: source.kind });
  }
  if (!result.logo) return notFound();
  return new Response(new Uint8Array(result.logo.bytes), {
    headers: { "Content-Type": result.logo.contentType, "Cache-Control": LOGO_CACHE_CONTROL },
  });
}

export const GET = withRoute("instruments.logo", handleGet);
