import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { undoRecategorize } from "@/lib/categorization/recategorize";
import { requestLogger, withRoute } from "@/lib/observability";
import { recategorizeUndoSchema } from "@/lib/validation/categorization-rules";

/**
 * POST /api/transactions/recategorize/undo — annulla l'ultima «Ricategorizza» (entro 7 giorni): rimette com'erano i
 * movimenti che nessuno ha cambiato dopo. 404 se non è più annullabile.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const parsed = recategorizeUndoSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const result = await undoRecategorize(session.user.id, parsed.data.runId);
  if (!result) return Response.json({ error: "Questa ricategorizzazione non si può più annullare" }, { status: 404 });
  requestLogger().info("categorization.recategorize.undone", { count: result.restored });
  return Response.json(result);
}

export const POST = withRoute("transactions.recategorize_undo", handlePost);
