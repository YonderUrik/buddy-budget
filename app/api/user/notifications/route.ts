import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { getNotificationPreferences, saveNotificationPreferences } from "@/lib/notifications/server";
import { requestLogger, withRoute } from "@/lib/observability";
import { updateNotificationPreferencesSchema } from "@/lib/validation/notifications";

/** Preferenze sulle email di riepilogo e avviso dell'utente (default: tutto spento finché non sceglie). */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  return Response.json(await getNotificationPreferences(session.user.id));
}

/** Aggiorna le preferenze (anche solo una). Spegnere un tipo è immediato: il cron legge sempre lo stato salvato. */
async function handlePatch(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const parsed = updateNotificationPreferencesSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }
  const preferences = await saveNotificationPreferences(session.user.id, parsed.data);
  requestLogger().info("notifications.preferences.updated", { count: Object.keys(parsed.data).length });
  return Response.json(preferences);
}

export const GET = withRoute("user.notifications.get", handleGet);
export const PATCH = withRoute("user.notifications.update", handlePatch);
