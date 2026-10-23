import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listHouseholds } from "@/lib/households/data";
import { createHousehold, householdErrorResponse } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";
import { createHouseholdSchema } from "@/lib/validation/households";

/** The viewer's groups with their members. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await listHouseholds(session.user.id));
}

/** Creates a group with the viewer as first member and what they show it. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const log = requestLogger();
  const parsed = createHouseholdSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const id = await createHousehold(session.user.id, parsed.data.name, parsed.data.sharing);
    recordHouseholdAction("created");
    log.info("household.group.created", { count: parsed.data.sharing.accountIds.length });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    log.info("household.group.rejected", { reason: (error as { code: string }).code });
    return response;
  }
}

export const GET = withRoute("households.list", handleGet);
export const POST = withRoute("households.create", handlePost);
