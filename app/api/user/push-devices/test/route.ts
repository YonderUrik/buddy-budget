import { NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { TEST_EMAIL_MAX_PER_HOUR } from "@/lib/notifications";
import { claimKeys, countRecentTests } from "@/lib/notifications/server";
import { requestLogger, withRoute } from "@/lib/observability";
import { defaultPushDeps, listPushDevices, sendPushToDevices } from "@/lib/push";

/** Text of the test notification: shows how alerts will look, without data. */
const TEST_PUSH = { title: "BuddyBudget", body: "Le notifiche sul telefono funzionano. Da qui arriveranno avvisi e riepiloghi.", path: "/impostazioni?sezione=notifiche#impostazioni-notifiche" };

/**
 * Sends a test notification to the phones of the user, so they see that it works. Shares the hourly limit of the test
 * email (`TEST_EMAIL_MAX_PER_HOUR`).
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const now = new Date();
  const log = requestLogger();
  if ((await countRecentTests(session.user.id, now)) >= TEST_EMAIL_MAX_PER_HOUR) {
    return Response.json({ error: "Hai già chiesto alcune prove: riprova tra un po'." }, { status: 429 });
  }
  const devices = await listPushDevices(session.user.id);
  if (devices.length === 0) return Response.json({ error: "Questo account non ha telefoni con le notifiche attive." }, { status: 409 });
  await claimKeys(session.user.id, "test", [crypto.randomUUID()], now);
  const result = await sendPushToDevices(devices, "test", TEST_PUSH, defaultPushDeps());
  if (result.sent === 0) {
    log.warn("push.test.failed", { kind: "test", rejected: result.failed, skipped: result.unconfigured, deleted: result.removed });
    return Response.json({ error: "Non siamo riusciti a mandare la notifica. Riprova tra poco." }, { status: 502 });
  }
  log.info("push.test.sent", { kind: "test", count: result.sent });
  return new Response(null, { status: 204 });
}

export const POST = withRoute("user.push_devices.test", handlePost);
