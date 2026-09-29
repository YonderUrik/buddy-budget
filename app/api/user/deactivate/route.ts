import { NextRequest } from "next/server";
import { sendAccountEmail } from "@/lib/account/emails";
import { scheduleAccountDeletion } from "@/lib/account/lifecycle";
import { recentLoginRequired, sessionOrUnauthorized } from "@/lib/account/route-session";
import { requestLogger, withRoute } from "@/lib/observability";

/**
 * Disattiva l'account: eliminazione definitiva programmata dopo il periodo di ripensamento, altre sessioni chiuse,
 * sync e cron fermi per l'utente. Rientrando prima della data si può riattivare.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const denied = recentLoginRequired(session);
  if (denied) return denied;
  if (session.user.deletionScheduledAt) {
    return Response.json({ error: "L'account è già disattivato." }, { status: 409 });
  }

  const deletionAt = await scheduleAccountDeletion(session.user.id, session.session.id);
  await sendAccountEmail(session.user.email, "deactivated", { userId: session.user.id, deletionAt });
  requestLogger().info("account.deactivation.completed");
  return Response.json({ deletionScheduledAt: deletionAt.toISOString() });
}

export const POST = withRoute("user.deactivate", handlePost);
