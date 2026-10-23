import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { acceptInvite, householdErrorResponse } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";
import { acceptInviteSchema } from "@/lib/validation/households";

type Context = { params: Promise<{ token: string }> };

/** Accepts an invitation with what the viewer shows the group. */
async function handlePost(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const log = requestLogger();
  const parsed = acceptInviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const id = await acceptInvite(session.user.id, (await params).token, parsed.data.sharing);
    recordHouseholdAction("invite_accepted");
    log.info("household.invite.accepted", { count: parsed.data.sharing.accountIds.length });
    return Response.json({ id });
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    log.info("household.invite.rejected", { reason: (error as { code: string }).code });
    return response;
  }
}

export const POST = withRoute("invites.accept", handlePost);
