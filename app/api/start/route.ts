import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { bindRequestUser, recordStartEvent, requestLogger, withRoute } from "@/lib/observability";
import { START_FOCUS_IDS, countDoneSteps } from "@/lib/start";
import { loadStartStatus, setChecklistDismissed, setStartFocus } from "@/lib/start/status";

/** Either closes/reopens the checklist or changes what the user keeps an eye on. */
const updateSchema = z.union([
  z.object({ dismissed: z.boolean() }).strict(),
  z.object({ focus: z.array(z.enum(START_FOCUS_IDS)).max(START_FOCUS_IDS.length) }).strict(),
]);

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

/** Closes (`dismissed: true`) or reopens the checklist, or saves a new `focus` (which steps it asks for). */
async function handlePatch(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Dati non validi" }, { status: 400 });
  if ("focus" in parsed.data) {
    const focus = [...new Set(parsed.data.focus)];
    await setStartFocus(session.user.id, focus);
    recordStartEvent("focus_changed");
    requestLogger().info("onboarding.focus.updated", { trigger: "checklist", count: focus.length });
    return new Response(null, { status: 204 });
  }
  const { dismissed } = parsed.data;
  const status = await loadStartStatus(session.user.id);
  await setChecklistDismissed(session.user.id, dismissed);
  recordStartEvent(dismissed ? "checklist_dismissed" : "checklist_reopened");
  requestLogger().info(dismissed ? "onboarding.checklist.dismissed" : "onboarding.checklist.reopened", { count: countDoneSteps(status.steps, status.stepIds) });
  return new Response(null, { status: 204 });
}

export const GET = withRoute("start.get", handleGet);
export const PATCH = withRoute("start.update", handlePatch);
