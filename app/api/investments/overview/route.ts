import { after, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getNetWorthPeriodRange, toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import { loadInvestmentData } from "@/lib/investments/data";
import { ensureDividendsSafely, ensureProfilesSafely } from "@/lib/market-data/runtime";
import { bindRequestUser, withRoute } from "@/lib/observability";

const PERIODS: readonly NetWorthPeriod[] = ["1mese", "3mesi", "1anno", "max"];

export const maxDuration = 60;

/**
 * Dati del portafoglio dell'utente: operazioni, strumenti, prezzi e cambi dal periodo richiesto in poi.
 * I calcoli (posizioni, valore, grafico) si fanno lato client con `lib/calc/investments.ts`, come per Cash flow.
 * Gli strumenti senza profilo (settori, area, primi titoli) o senza storico dividendi li scaricano in background.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const requested = request.nextUrl.searchParams.get("period") as NetWorthPeriod | null;
  const period = requested && PERIODS.includes(requested) ? requested : "3mesi";
  const pricesFrom = period === "max" ? null : toDateKey(getNetWorthPeriodRange(period, new Date(), null).from);
  const data = await loadInvestmentData(session.user.id, pricesFrom);
  await ensureProfilesSafely(data.instruments, after);
  await ensureDividendsSafely(data.instruments, after);
  return Response.json(data);
}

export const GET = withRoute("investments.overview", handleGet);
