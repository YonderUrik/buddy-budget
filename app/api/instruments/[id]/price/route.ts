import { NextRequest, after } from "next/server";
import { auth } from "@/lib/auth";
import { ensureHistorySafely } from "@/lib/investments/history";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { findPriceOnDate } from "@/lib/investments/prices";
import { redisBackfillStore } from "@/lib/market-data/redis-stores";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { redis } from "@/lib/redis/client";

// Il recupero dei prezzi dalla data richiesta gira in after().
export const maxDuration = 300;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Un recupero per strumento e data ogni ora al massimo: se le fonti non hanno prezzi per quella data (strumento
 * quotato dopo, fonte giù) il polling del client non deve ripartire all'infinito.
 */
const ATTEMPT_TTL_SECONDS = 60 * 60;

/** True alla prima richiesta di recupero per strumento e data nell'ultima ora; con Redis giù si tenta comunque. */
async function claimAttempt(instrumentId: string, date: string): Promise<boolean> {
  try {
    return (await redis.set(`market:price-on-date:${instrumentId}:${date}`, "1", "EX", ATTEMPT_TTL_SECONDS, "NX")) === "OK";
  } catch {
    return true;
  }
}

async function isBackfillRunning(instrumentId: string): Promise<boolean> {
  try {
    const [state] = await redisBackfillStore.views([instrumentId]);
    return state?.status === "running" && !state.interrupted;
  } catch {
    return false;
  }
}

/**
 * Prezzo di uno strumento a una data (`?date=YYYY-MM-DD`), per precompilare il form di un'operazione. Se per
 * quella data non c'è ancora un prezzo avvia il recupero dello storico (una volta, vedi `ATTEMPT_TTL_SECONDS`) e
 * risponde `loading: true`: il client riprova finché il recupero è in corso. Lo stesso recupero serve comunque
 * all'operazione che si sta per salvare.
 */
async function handleGet(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!DATE_KEY.test(date)) return Response.json({ error: "Data non valida" }, { status: 400 });

  const { id } = await params;
  const instrument = await findVisibleInstrument(session.user.id, id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });

  const price = await findPriceOnDate(session.user.id, id, date);
  if (price || instrument.priceMode !== "auto") return Response.json({ price, loading: false });

  if (await isBackfillRunning(id)) return Response.json({ price: null, loading: true });
  if (!(await claimAttempt(id, date))) return Response.json({ price: null, loading: false });
  await ensureHistorySafely(instrument, date, after);
  return Response.json({ price: null, loading: await isBackfillRunning(id) });
}

export const GET = withRoute("instruments.price_on_date", handleGet, { quietOnSuccess: true });
