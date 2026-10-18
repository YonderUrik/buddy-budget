import { ImportError } from "@/lib/personal-import/contract";
import { after, NextRequest } from "next/server";
import { categorizeNewMovementsSafely } from "@/lib/categorization/auto-apply";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isTrustedWriteOrigin } from "@/lib/http";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { getPreview, reanalyze } from "@/lib/personal-import/jobs";
import { confirmImport } from "@/lib/personal-import/confirm";
import { previewPersonalImportDeletion, deletePersonalImport } from "@/lib/personal-import/delete";
export const maxDuration = 60;
function idOf(request: NextRequest) { return z.uuid().safeParse(new URL(request.url).pathname.split("/").at(-1)); }
export const GET = withRoute("personal_import.preview", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const id = idOf(request); if (!id.success) return new Response(null, { status: 404 });
  if (request.nextUrl.searchParams.get("deletion") === "1") {
    try { return Response.json(await previewPersonalImportDeletion(session.user.id, id.data), { headers: { "Cache-Control": "no-store" } }); }
    catch (error) { return Response.json({ error: error instanceof ImportError ? error.message : "Impossibile verificare l’importazione" }, { status: 422 }); }
  }
  const preview = await getPreview(session.user.id, id.data);
  return Response.json(preview ?? { error: "Anteprima non disponibile" }, { status: preview ? 200 : 404, headers: { "Cache-Control": "no-store" } });
});
// Senza corpo conferma l'anteprima; `import_skipping_errors` importa le righe riconosciute saltando le altre;
// `reanalyze` rimanda il file all'AI (consenso richiesto di nuovo, come al caricamento).
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("import_skipping_errors") }),
  z.object({ action: z.literal("reanalyze"), consent: z.literal(true), consentVersion: z.literal("openrouter-raw-zdr-v3") }),
]);
export const POST = withRoute("personal_import.confirm", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  if (!isTrustedWriteOrigin(request)) return new Response(null, { status: 403 });
  const id = idOf(request); if (!id.success) return new Response(null, { status: 404 });
  const raw = await request.text();
  let parsedBody: unknown = null;
  if (raw) { try { parsedBody = JSON.parse(raw); } catch { return Response.json({ error: "Azione non valida" }, { status: 400 }); } }
  const hasAction = typeof parsedBody === "object" && parsedBody !== null && "action" in parsedBody;
  const body = hasAction ? actionSchema.safeParse(parsedBody) : null;
  if (hasAction && !body?.success) return Response.json({ error: "Azione non valida" }, { status: 400 });
  const action = body?.success ? body.data : null;
  try {
    if (action?.action === "reanalyze") {
      const job = await reanalyze(session.user.id, id.data);
      requestLogger().info("personal_import.reanalyzed", { jobId: job.id });
      return Response.json(job, { status: 202 });
    }
    const skipErrors = action?.action === "import_skipping_errors";
    const result = await confirmImport(session.user.id, id.data, { skipErrors });
    const userId = session.user.id; after(() => categorizeNewMovementsSafely(userId));
    requestLogger().info("personal_import.confirmed", { inserted: result.inserted, skipped: result.skipped ?? 0 });
    return Response.json(result);
  }
  catch (error) { return Response.json({ error: error instanceof ImportError ? error.message : "Importazione non riuscita: nessuna modifica salvata" }, { status: 422 }); }
});

export const DELETE = withRoute("personal_import.delete", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  if (!isTrustedWriteOrigin(request)) return new Response(null, { status: 403 });
  const id = idOf(request); if (!id.success) return new Response(null, { status: 404 });
  const body = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Conferma non valida" }, { status: 400 });
  try {
    const result = await deletePersonalImport(session.user.id, id.data, body.data.token);
    requestLogger().info("personal_import.deleted", { deleted: result.cashCount + result.investmentCount });
    return Response.json(result);
  } catch (error) { return Response.json({ error: error instanceof ImportError ? error.message : "Eliminazione non riuscita: nessuna modifica salvata" }, { status: 422 }); }
});
