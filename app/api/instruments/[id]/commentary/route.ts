import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { buildCommentaryPrompt, COMMENTARY_CACHE_TTL_SECONDS, commentatorFromEnv } from "@/lib/investments/commentary";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { computeTitleStats } from "@/lib/investments/title-stats";
import { loadTitleCloses } from "@/lib/investments/title-view";
import { fundamentalsOnProviders } from "@/lib/market-data/runtime";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { redis } from "@/lib/redis/client";

export const maxDuration = 90;

/** Al massimo una generazione ogni tot secondi per utente: un modello locale è lento e il commento non cambia. */
const USER_COOLDOWN_SECONDS = 20;

/**
 * Commento sul titolo scritto dal modello locale, solo con dati pubblici dello strumento. Senza `OLLAMA_BASE_URL`
 * risponde `available: false` (stato normale). Il testo si tiene su Redis per mezza giornata, per strumento e
 * ultima chiusura: la stessa pagina riaperta non rigenera niente.
 */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const commentator = commentatorFromEnv();
  if (!commentator) return Response.json({ available: false, text: null });

  const { id } = await params;
  const instrument = await findVisibleInstrument(session.user.id, id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  const stats = computeTitleStats(await loadTitleCloses(session.user.id, instrument), new Date().toISOString().slice(0, 10));
  if (!stats) return Response.json({ error: "Non ci sono ancora prezzi per questo titolo" }, { status: 400 });

  const cacheKey = `market:commentary:${id}:${stats.lastDate}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ available: true, text: cached, cached: true });
    const claimed = await redis.set(`market:commentary-cooldown:${session.user.id}`, "1", "EX", USER_COOLDOWN_SECONDS, "NX");
    if (claimed !== "OK") return Response.json({ error: "Attendi qualche secondo prima di chiedere un altro commento" }, { status: 429 });
  } catch {
    // Redis giù: si genera comunque, senza cache né pausa.
  }

  const fundamentals = await fundamentalsOnProviders(instrument);
  const text = await commentator.comment(
    buildCommentaryPrompt({
      name: instrument.name,
      type: instrument.type,
      currency: instrument.currency,
      stats,
      fundamentals: fundamentals.status === "ok" ? fundamentals.fundamentals : null,
    })
  );
  if (!text) {
    requestLogger().warn("instruments.commentary.empty", { reason: "no_text" });
    return Response.json({ available: true, text: null });
  }
  try {
    await redis.set(cacheKey, text, "EX", COMMENTARY_CACHE_TTL_SECONDS);
  } catch {
    // Cache non scrivibile: il commento vale comunque.
  }
  return Response.json({ available: true, text, cached: false });
}

export const POST = withRoute("instruments.commentary", handlePost);
