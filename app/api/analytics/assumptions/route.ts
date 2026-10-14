import { withCountryGuard } from "@/lib/localization/guard";
import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { loadAssumptions, saveAssumptions } from "@/lib/analitiche/data";
import { countChangedFields, mergeAssumptions, updateAssumptionsSchema } from "@/lib/analitiche/assumptions";
import { dataPeriodKind } from "@/lib/analitiche/period";
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
  const next = mergeAssumptions(current.assumptions, parsed.data as Partial<typeof current.assumptions>);
  await saveAssumptions(session.user.id, next);
  const log = requestLogger();
  log.info("analytics.assumptions.saved", { count: countChangedFields(current.assumptions, next) });
  if (next.expectedReturnAuto !== current.assumptions.expectedReturnAuto) {
    log.info("analytics.return_source.changed", { kind: next.expectedReturnAuto ? "storico" : "manuale" });
  }
  if (JSON.stringify(next.dataPeriod) !== JSON.stringify(current.assumptions.dataPeriod)) {
    log.info("analytics.data_period.changed", { kind: dataPeriodKind(next.dataPeriod) });
  }
  return Response.json({ assumptions: next, walkthroughSeen: current.walkthroughSeen });
}

export const GET = withRoute("analytics.assumptions.get", withCountryGuard(handleGet));
export const PUT = withRoute("analytics.assumptions.update", withCountryGuard(handlePut));
