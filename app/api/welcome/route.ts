import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { requestLogger, withRoute } from "@/lib/observability";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { hasWelcomeContent, isWelcomeShown, type WelcomeResponse } from "@/lib/welcome";
import { computeWelcomeSummary, userCurrency } from "@/lib/welcome/summary.server";
import { markWelcomeShown, touchVisit } from "@/lib/welcome/visit.server";
import { logVisitStart } from "@/lib/welcome/visit-log.server";

const updateSchema = z.object({ shown: z.literal(true) }).strict();

/**
 * GET /api/welcome — what the «Dall'ultima visita» toast says. It records the visit first (same heartbeat as
 * `POST /api/visits`), so the first request of a visit cannot read the previous visit's state; `summary` is null on
 * the first visit, once the toast was shown during this visit, or when there is nothing to say.
 */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const currency = await userCurrency(userId);
  const empty: WelcomeResponse = { summary: null, currency };
  if (isPublicDemoUserId(userId)) return Response.json(empty);

  const touch = await touchVisit(userId);
  if (!touch) return Response.json(empty);
  logVisitStart(touch, "welcome");
  const { visitSinceAt, visitStartedAt } = touch.state;
  if (!visitSinceAt || !visitStartedAt || isWelcomeShown(touch.state)) return Response.json(empty);

  const summary = await computeWelcomeSummary(userId, { since: visitSinceAt, until: visitStartedAt });
  if (!hasWelcomeContent(summary)) return Response.json(empty);
  requestLogger().info("welcome.summary.built", { count: summary.happened.length, pending: summary.waiting.length });
  return Response.json({ summary, currency } satisfies WelcomeResponse);
}

/** PATCH /api/welcome `{ shown: true }` — the toast appeared: not again until the next visit, on any device. */
async function handlePatch(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  if (!updateSchema.safeParse(await readJson(request)).success) return Response.json({ error: "Dati non validi" }, { status: 400 });
  await markWelcomeShown(session.user.id);
  requestLogger().info("welcome.toast.shown");
  return new Response(null, { status: 204 });
}

export const GET = withRoute("welcome.get", handleGet, { quietOnSuccess: true });
export const PATCH = withRoute("welcome.shown", handlePatch);
