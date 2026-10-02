import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/**
 * POST /api/transactions/attention/seen — segna come viste le transazioni importate finora: da questo momento
 * "nuove" sono solo quelle che arrivano dopo. Si chiama aprendo le schermate dei movimenti.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  await db.update(authUser).set({ movementsSeenAt: new Date() }).where(eq(authUser.id, session.user.id));
  requestLogger().info("transactions.attention.seen");
  return new Response(null, { status: 204 });
}

export const POST = withRoute("transactions.attention_seen", handlePost);
