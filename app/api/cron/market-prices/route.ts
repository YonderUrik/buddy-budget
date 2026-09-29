import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { marketDataDeps } from "@/lib/market-data/runtime";
import { updateInflationIndex } from "@/lib/market-data/inflation";
import { updateHeldInstruments } from "@/lib/market-data/update";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron serale dei prezzi di mercato: aggiorna le chiusure degli strumenti posseduti (e dei benchmark) dalla catena
 * di fonti, i cambi e l'indice d'inflazione. Gira prima dello snapshot del patrimonio. Risponde solo con conteggi, mai dati di utenti.
 */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  const log = requestLogger();
  try {
    const deps = marketDataDeps();
    const summary = await updateHeldInstruments(new Date(), deps);
    // Non fa mai fallire il cron: un errore di Eurostat si logga dentro.
    const inflationMonths = await updateInflationIndex(new Date(), deps.ctx, { provider: deps.inflationProvider, log });
    const durationMs = Date.now() - startedAt;
    log.info("market.prices.updated", {
      total: summary.instruments,
      processed: summary.updated,
      count: summary.fromFallback,
      reason: `failed:${summary.failed},suspect:${summary.suspect},fx:${summary.fxRates}`,
    });
    await recordCronRun("market_prices", "success", durationMs, { store: redisOpsStore, log });
    return Response.json({ ok: true, durationMs, ...summary, inflationMonths });
  } catch (error) {
    await recordCronRun("market_prices", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
}

export const GET = withRoute("cron.market_prices", handleGet);
