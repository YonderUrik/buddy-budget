import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getNetWorthPeriodRange, toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import { loadInvestmentData } from "@/lib/investments/data";
import { bindRequestUser, withRoute } from "@/lib/observability";

const PERIODS: readonly NetWorthPeriod[] = ["1mese", "3mesi", "1anno", "max"];

/**
 * Dati del portafoglio dell'utente: operazioni, strumenti, PAC, prezzi e cambi dal periodo richiesto in poi.
 * I calcoli (posizioni, valore, grafico) si fanno lato client con `lib/calc/investments.ts`, come per Cash flow.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const requested = request.nextUrl.searchParams.get("period") as NetWorthPeriod | null;
  const period = requested && PERIODS.includes(requested) ? requested : "3mesi";
  const pricesFrom = period === "max" ? null : toDateKey(getNetWorthPeriodRange(period, new Date(), null).from);
  return Response.json(await loadInvestmentData(session.user.id, pricesFrom));
}

export const GET = withRoute("investments.overview", handleGet);
