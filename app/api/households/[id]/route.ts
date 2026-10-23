import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { loadHouseholdSettings } from "@/lib/households/data";
import { householdErrorResponse, updateHousehold } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";
import { updateHouseholdSchema } from "@/lib/validation/households";

type Context = { params: Promise<{ id: string }> };

/** The group page: members, pending invitations, what the viewer shows. */
async function handleGet(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const settings = await loadHouseholdSettings(session.user.id, (await params).id);
  return settings ? Response.json(settings) : Response.json({ error: "Gruppo non trovato" }, { status: 404 });
}

/** Renames the group or changes what the viewer shows it. */
async function handlePatch(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const parsed = updateHouseholdSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    await updateHousehold(session.user.id, (await params).id, parsed.data);
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    return response;
  }
  if (parsed.data.sharing) {
    recordHouseholdAction("sharing_changed");
    requestLogger().info("household.sharing.updated", { count: parsed.data.sharing.accountIds.length });
  }
  return new Response(null, { status: 204 });
}

export const GET = withRoute("households.get", handleGet);
export const PATCH = withRoute("households.update", handlePatch);
