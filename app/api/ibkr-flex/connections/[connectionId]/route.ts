import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isTrustedWriteOrigin } from "@/lib/http/same-origin";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { disconnectIbkrFlex } from "@/lib/ibkr-flex";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Remove the connection and its token; only the owner can, and imported history stays. */
async function handleDelete(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  if (!isTrustedWriteOrigin(request)) return new Response(null, { status: 403 });
  const { connectionId } = await params;
  if (!UUID.test(connectionId) || !await disconnectIbkrFlex(session.user.id, connectionId)) return new Response(null, { status: 404 });
  requestLogger().info("ibkr_flex.disconnect.succeeded", { connectionId });
  return new Response(null, { status: 204 });
}

export const DELETE = withRoute("ibkr_flex.connections.delete", handleDelete);
