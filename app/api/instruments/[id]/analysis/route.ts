import { NextRequest, after } from "next/server";
import { auth } from "@/lib/auth";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { TITLE_CHART_PERIODS, TITLE_DEFAULT_CHART_PERIOD, type TitleChartPeriod } from "@/lib/investments/title-stats";
import { buildTitleAnalysis } from "@/lib/investments/title-view";
import { bindRequestUser, withRoute } from "@/lib/observability";

// Il recupero dello storico mancante gira in after().
export const maxDuration = 300;

/** Pagina di un titolo: grafico, statistiche, posizione, watchlist, avvisi e numeri chiave (`?period=1M|3M|6M|1A|5A|Max`). */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const requested = request.nextUrl.searchParams.get("period") ?? TITLE_DEFAULT_CHART_PERIOD;
  if (!(TITLE_CHART_PERIODS as readonly string[]).includes(requested)) {
    return Response.json({ error: "Periodo non valido" }, { status: 400 });
  }
  const { id } = await params;
  const instrument = await findVisibleInstrument(session.user.id, id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });

  return Response.json(await buildTitleAnalysis(session.user.id, instrument, requested as TitleChartPeriod, after));
}

export const GET = withRoute("instruments.analysis", handleGet);
