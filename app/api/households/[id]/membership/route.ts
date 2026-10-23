import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { householdErrorResponse, leaveHousehold } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";

type Context = { params: Promise<{ id: string }> };

/** The viewer leaves the group: what they shared stops being visible at once. */
async function handleDelete(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  try {
    const { deleted } = await leaveHousehold(session.user.id, (await params).id);
    recordHouseholdAction("left");
    requestLogger().info("household.member.left", { outcome: deleted ? "group_deleted" : "group_kept" });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    return response;
  }
}

export const DELETE = withRoute("households.leave", handleDelete);
