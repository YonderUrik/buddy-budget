import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { loadAssumptions, saveAssumptions } from "@/lib/analitiche/data";
import { countChangedFields, resolveAssumptions, updateAssumptionsSchema } from "@/lib/analitiche/assumptions";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/** Ipotesi di Analitiche dell'utente (con i default) e stato della guida iniziale. */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  return Response.json(await loadAssumptions(session.user.id));
}

/** Aggiorna alcune ipotesi; restituisce quelle risultanti. */
async function handlePut(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const parsed = updateAssumptionsSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }
  const current = await loadAssumptions(session.user.id);
  const next = resolveAssumptions({ ...current.assumptions, ...parsed.data });
  await saveAssumptions(session.user.id, next);
  requestLogger().info("analytics.assumptions.saved", { count: countChangedFields(current.assumptions, next) });
  return Response.json({ assumptions: next, walkthroughSeen: current.walkthroughSeen });
}

export const GET = withRoute("analytics.assumptions.get", handleGet);
export const PUT = withRoute("analytics.assumptions.update", handlePut);
