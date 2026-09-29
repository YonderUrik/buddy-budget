import { NextRequest } from "next/server";
import { cancelAccountDeletion } from "@/lib/account/lifecycle";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { requestLogger, withRoute } from "@/lib/observability";

/** Riattiva un account disattivato prima della data di eliminazione. Basta aver fatto l'accesso. */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  if (!session.user.deletionScheduledAt) {
    return new Response(null, { status: 204 });
  }
  await cancelAccountDeletion(session.user.id);
  requestLogger().info("account.reactivation.completed");
  return new Response(null, { status: 204 });
}

export const POST = withRoute("user.reactivate", handlePost);
