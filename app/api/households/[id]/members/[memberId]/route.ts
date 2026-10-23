import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { householdErrorResponse, removePerson } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";

type Context = { params: Promise<{ id: string; memberId: string }> };

/** Removes someone added by name, with the expenses written as paid by them. */
async function handleDelete(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id, memberId } = await params;
  try {
    await removePerson(session.user.id, id, memberId);
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    return response;
  }
  recordHouseholdAction("person_removed");
  requestLogger().info("household.person.removed");
  return new Response(null, { status: 204 });
}

export const DELETE = withRoute("households.person_remove", handleDelete);
