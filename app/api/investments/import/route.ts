import { NextRequest, after } from "next/server";
import { auth } from "@/lib/auth";
import { categorizeNewMovementsSafely } from "@/lib/categorization/auto-apply";
import { investmentImportDeps } from "@/lib/investments/import/deps";
import { runStatementImport } from "@/lib/investments/import/execute-statement";
import { runImport } from "@/lib/investments/import/execute";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { runImportSchema } from "@/lib/validation/investments-import";
import { saveFormatMetadata } from "@/lib/imports/store";

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

  if (!parsed.data.statementCsv && parsed.data.operations.some((o) => o.type === "rettifica")) return Response.json({ error: "Le rettifiche richiedono il CSV originale" }, { status: 400 });
  const execute = parsed.data.statementCsv ? runStatementImport : runImport;
  const result = await execute(userId, parsed.data, await investmentImportDeps(userId, after));

  if (result.error) return Response.json(result, { status: 422 });
  if (!parsed.data.dryRun && result.counts.error > 0) return Response.json(result, { status: 400 });
  if (parsed.data.formatMetadata && !parsed.data.statementCsv) {
    try { await saveFormatMetadata(userId, "mapping", parsed.data.formatMetadata, parsed.data.operations); }
    catch { requestLogger().warn("import.metadata.failed", { reason: "persistence_failed" }); }
  }
  if (!parsed.data.dryRun) {
    requestLogger().info("investments.import.completed", { inserted: result.inserted });
    // I movimenti di cassa del rendiconto (es. carta Trade Republic) passano dallo stesso giro della banca.
    if (parsed.data.statementCsv && result.inserted > 0) after(() => categorizeNewMovementsSafely(userId));
  }
  return Response.json(result, { status: parsed.data.dryRun ? 200 : 201 });
}

export const POST = withRoute("investment_import.run", handlePost);
