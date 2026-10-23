import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { householdErrorResponse, revokeInvite } from "@/lib/households/server";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

type Context = { params: Promise<{ id: string; inviteId: string }> };

/** Withdraws a pending invitation: its link stops working. */
async function handleDelete(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id, inviteId } = await params;
  try {
    await revokeInvite(session.user.id, id, inviteId);
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    return response;
  }
  requestLogger().info("household.invite.revoked");
  return new Response(null, { status: 204 });
}

export const DELETE = withRoute("households.invite_revoke", handleDelete);
