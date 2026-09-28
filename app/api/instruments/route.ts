import { NextRequest, after } from "next/server";
import { auth } from "@/lib/auth";
import { createOrReuseInstrument } from "@/lib/investments/instruments";
import { ensureHistory, INITIAL_HISTORY_DAYS, quoteMetaOnProviders } from "@/lib/market-data/runtime";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { createInstrumentSchema } from "@/lib/validation/investments";

// Il recupero dello storico gira in after(): la funzione resta viva al massimo per questo tempo (secondi).
export const maxDuration = 300;

/** Crea uno strumento (o riusa quello esistente) e avvia in background il recupero degli ultimi prezzi. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const parsed = createInstrumentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const outcome = await createOrReuseInstrument(session.user.id, parsed.data, { quoteMeta: quoteMetaOnProviders });
  if (!outcome.ok) return Response.json({ error: outcome.error }, { status: outcome.status });

  const from = new Date(Date.now() - INITIAL_HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
  try {
    await ensureHistory(outcome.instrument, from, after);
  } catch (error) {
    // Lo strumento esiste già: senza storico il cron serale lo recupererà comunque.
    requestLogger().warn("market.backfill.not_started", { error });
  }
  return Response.json(outcome.instrument, { status: outcome.created ? 201 : 200 });
}

export const POST = withRoute("instruments.create", handlePost);
