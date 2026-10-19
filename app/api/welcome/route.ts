import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { requestLogger, withRoute } from "@/lib/observability";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { hasWelcomeContent, isWelcomeDismissed, type WelcomeResponse } from "@/lib/welcome";
import { computeWelcomeSummary, userCurrency } from "@/lib/welcome/summary.server";
import { dismissWelcome, touchVisit } from "@/lib/welcome/visit.server";
import { logVisitStart } from "@/lib/welcome/visit-log.server";

const updateSchema = z.object({ dismissed: z.literal(true) }).strict();

/**
 * GET /api/welcome — the «Dall'ultima visita» summary of Panoramica. It records the visit first (same heartbeat as
 * `POST /api/visits`), so opening the app on Panoramica cannot read the previous visit's state; `summary` is null on
 * the first visit, when closed during this visit or when there is nothing to say.
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
  if (!visitSinceAt || !visitStartedAt || isWelcomeDismissed(touch.state)) return Response.json(empty);

  const summary = await computeWelcomeSummary(userId, { since: visitSinceAt, until: visitStartedAt });
  if (!hasWelcomeContent(summary)) return Response.json(empty);
  requestLogger().info("welcome.summary.built", { count: summary.happened.length, pending: summary.waiting.length });
  return Response.json({ summary, currency } satisfies WelcomeResponse);
}

/** PATCH /api/welcome `{ dismissed: true }` — closes the summary until the next visit. */
async function handlePatch(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  if (!updateSchema.safeParse(await readJson(request)).success) return Response.json({ error: "Dati non validi" }, { status: 400 });
  await dismissWelcome(session.user.id);
  requestLogger().info("welcome.summary.dismissed");
  return new Response(null, { status: 204 });
}

export const GET = withRoute("welcome.get", handleGet, { quietOnSuccess: true });
export const PATCH = withRoute("welcome.dismiss", handlePatch);
