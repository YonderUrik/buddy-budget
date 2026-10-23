import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { householdErrorResponse, settleHousehold } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";

type Context = { params: Promise<{ id: string }> };

/** «Pareggiate»: records the payments that bring every balance of the group to zero. */
async function handlePost(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  try {
    const count = await settleHousehold(session.user.id, (await params).id);
    recordHouseholdAction("settled");
    requestLogger().info("household.balance.settled", { count });
    return Response.json({ transfers: count });
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    return response;
  }
}

export const POST = withRoute("households.settle", handlePost);
