import { ImportError } from "@/lib/personal-import/contract";
import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { getPreview } from "@/lib/personal-import/jobs";
import { confirmImport } from "@/lib/personal-import/confirm";
import { previewPersonalImportDeletion, deletePersonalImport } from "@/lib/personal-import/delete";
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
export const POST = withRoute("personal_import.confirm", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  if (request.headers.get("origin") !== new URL(process.env.APP_URL ?? request.url).origin) return new Response(null, { status: 403 });
  const id = idOf(request); if (!id.success) return new Response(null, { status: 404 });
  try { const result = await confirmImport(session.user.id, id.data); requestLogger().info("personal_import.confirmed", { inserted: result.inserted }); return Response.json(result); }
  catch (error) { return Response.json({ error: error instanceof ImportError ? error.message : "Importazione non riuscita: nessuna modifica salvata" }, { status: 422 }); }
});

export const DELETE = withRoute("personal_import.delete", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  if (request.headers.get("origin") !== new URL(process.env.APP_URL ?? request.url).origin) return new Response(null, { status: 403 });
  const id = idOf(request); if (!id.success) return new Response(null, { status: 404 });
  const body = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Conferma non valida" }, { status: 400 });
  try {
    const result = await deletePersonalImport(session.user.id, id.data, body.data.token);
    requestLogger().info("personal_import.deleted", { deleted: result.cashCount + result.investmentCount });
    return Response.json(result);
  } catch (error) { return Response.json({ error: error instanceof ImportError ? error.message : "Eliminazione non riuscita: nessuna modifica salvata" }, { status: 422 }); }
});
