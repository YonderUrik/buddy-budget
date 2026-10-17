import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { requestLogger, withRoute } from "@/lib/observability";
import { isPushConfigured, listPushDevices, registerPushDevice, removePushDevice } from "@/lib/push";
import { registerPushDeviceSchema, removePushDeviceSchema } from "@/lib/validation/push-devices";

/** Whether this server can send push notifications, and how many phones of the user can receive them. */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const devices = await listPushDevices(session.user.id);
  return Response.json({ configured: isPushConfigured(), devices: devices.length });
}

/** The native app registers (or refreshes, at every launch) the token of this phone. */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const parsed = registerPushDeviceSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  await registerPushDevice(session.user.id, parsed.data.platform, parsed.data.token);
  requestLogger().info("push.device.registered", { platform: parsed.data.platform });
  return new Response(null, { status: 204 });
}

/** The native app forgets this phone: no more notifications here. */
async function handleDelete(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const parsed = removePushDeviceSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  const removed = await removePushDevice(session.user.id, parsed.data.token);
  requestLogger().info("push.device.removed", { count: removed });
  return new Response(null, { status: 204 });
}

export const GET = withRoute("user.push_devices.get", handleGet);
export const POST = withRoute("user.push_devices.register", handlePost);
export const DELETE = withRoute("user.push_devices.remove", handleDelete);
