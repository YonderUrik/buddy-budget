import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { bindRequestUser, recordStartEvent, requestLogger, withRoute } from "@/lib/observability";
import { countDoneSteps } from "@/lib/start";
import { loadStartStatus, setChecklistDismissed } from "@/lib/start/status";

const updateSchema = z.object({ dismissed: z.boolean() });

/** Stato dei primi passi (checklist della Panoramica e dati d'esempio). */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const status = await loadStartStatus(session.user.id);
  if (status.justCompleted) {
    recordStartEvent("checklist_completed");
    requestLogger().info("onboarding.start.completed");
  }
  return Response.json(status);
}

/** Chiude (`dismissed: true`) o riapre la checklist. */
async function handlePatch(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Dati non validi" }, { status: 400 });
  const { dismissed } = parsed.data;
  const status = await loadStartStatus(session.user.id);
  await setChecklistDismissed(session.user.id, dismissed);
  recordStartEvent(dismissed ? "checklist_dismissed" : "checklist_reopened");
  requestLogger().info(dismissed ? "onboarding.checklist.dismissed" : "onboarding.checklist.reopened", { count: countDoneSteps(status.steps) });
  return new Response(null, { status: 204 });
}

export const GET = withRoute("start.get", handleGet);
export const PATCH = withRoute("start.update", handlePatch);
