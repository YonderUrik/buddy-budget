import { NextRequest, after } from "next/server";
import { auth } from "@/lib/auth";
import { ensureHistorySafely } from "@/lib/investments/history";
import { runImport } from "@/lib/investments/import/execute";
import { createOrReuseInstrument } from "@/lib/investments/instruments";
import { getUserCurrency, todayKey } from "@/lib/investments/operations";
import { marketDataDeps, quoteMetaOnProviders } from "@/lib/market-data/runtime";
import { updateFxRates } from "@/lib/market-data/update";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { runImportSchema } from "@/lib/validation/investments-import";

// Il recupero dello storico degli strumenti importati gira in after().
export const maxDuration = 300;

/**
 * Import in blocco di operazioni lette da un file. `dryRun: true` restituisce solo l'anteprima (nuove, doppioni,
 * errori per riga). Altrimenti salva tutto in una transazione, o niente se una riga è in errore (400 con le righe).
 * Sincrono e non job in background: sono solo scritture sul DB (poche centinaia di righe in un secondo), come
 * l'applicazione della categorizzazione; solo lo storico dei prezzi parte in background.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = runImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const result = await runImport(userId, parsed.data, {
    userCurrency: await getUserCurrency(userId),
    todayKey: todayKey(),
    createInstrument: (input) => createOrReuseInstrument(userId, input, { quoteMeta: quoteMetaOnProviders }),
    fetchFx: async (currencies, from, to) => {
      try {
        await updateFxRates(currencies.filter((c) => c !== "EUR"), from, to, marketDataDeps());
      } catch (error) {
        requestLogger().warn("market.fx.failed", { error });
      }
    },
    ensureHistory: (instrument, from) => ensureHistorySafely(instrument, from, after),
  });

  if (result.error) return Response.json(result, { status: 422 });
  if (!parsed.data.dryRun && result.counts.error > 0) return Response.json(result, { status: 400 });
  if (!parsed.data.dryRun) {
    requestLogger().info("investments.import.completed", { inserted: result.inserted });
  }
  return Response.json(result, { status: parsed.data.dryRun ? 200 : 201 });
}

export const POST = withRoute("investment_import.run", handlePost);
